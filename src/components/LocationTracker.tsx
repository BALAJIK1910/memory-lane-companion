import { useEffect, useState } from 'react';
import { caregiverCol, caregiverDoc, onSnapshot, setDoc, handleFirestoreError, OperationType, getDoc } from '../lib/firebase';
import { SafeZone, Meeting } from '../types';
import { getDistance } from '../lib/utils';
import { useUser } from '../contexts/UserContext';

export function LocationTracker() {
  const { caregiverId } = useUser();
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  const [lastGeocodeTime, setLastGeocodeTime] = useState<number>(0);
  const [lastGeocodePos, setLastGeocodePos] = useState<{ lat: number, lng: number } | null>(null);
  const [lastGeocodeName, setLastGeocodeName] = useState<string>('');

  useEffect(() => {
    if (!caregiverId) return;
    const unsubscribe = onSnapshot(caregiverCol(caregiverId, 'meetings'), (snapshot) => {
      setMeetings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meeting)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `caregivers/${caregiverId}/meetings`);
    });
    return () => unsubscribe();
  }, [caregiverId]);

  useEffect(() => {
    if (!caregiverId) return;
    const unsubscribe = onSnapshot(caregiverCol(caregiverId, 'safeZones'), (snapshot) => {
      setSafeZones(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafeZone)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `caregivers/${caregiverId}/safeZones`);
    });
    return () => unsubscribe();
  }, [caregiverId]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => console.error('Geolocation error:', error),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!currentLocation || !caregiverId) return;

    const updateStatus = async () => {
      let outside = true;
      let minDistance = Infinity;
      let closest: SafeZone | null = null;

      if (safeZones.length > 0) {
        safeZones.forEach(zone => {
          const distance = getDistance(currentLocation.lat, currentLocation.lng, zone.lat, zone.lng);
          if (distance <= zone.radius) {
            outside = false;
          }
          if (distance < minDistance) {
            minDistance = distance;
            closest = zone;
          }
        });
      }

      if (meetings.length > 0) {
        meetings.forEach(meeting => {
          if (meeting.lat && meeting.lng && (meeting.status === 'not-started' || meeting.status === 'in-progress')) {
            const distance = getDistance(currentLocation.lat, currentLocation.lng, meeting.lat, meeting.lng);
            if (distance <= 50) {
              outside = false;
              if (distance < minDistance) {
                minDistance = distance;
                closest = { id: meeting.id, name: `Meeting: ${meeting.location}`, lat: meeting.lat, lng: meeting.lng, radius: 50 };
              }
            }
          }
        });
      }

      // Fetch current status to check exitTimestamp
      const statusSnap = await getDoc(caregiverDoc(caregiverId, 'userStatus', 'current'));
      const currentStatusData = statusSnap.exists() ? statusSnap.data() : null;

      let exitTimestamp = currentStatusData?.exitTimestamp || null;
      let detailedStatus: 'Safe' | 'Outside (Monitoring)' | 'Outside Safe Location' = 'Safe';

      const now = Date.now();

      if (outside) {
        if (!exitTimestamp) {
          exitTimestamp = new Date().toISOString();
        }

        const exitTime = new Date(exitTimestamp).getTime();
        const timeOutside = (now - exitTime) / 1000 / 60; // minutes

        if (timeOutside >= 10) {
          detailedStatus = 'Outside Safe Location';
        } else {
          detailedStatus = 'Outside (Monitoring)';
        }
      } else {
        exitTimestamp = null;
        detailedStatus = 'Safe';
      }

      let locationName = lastGeocodeName || closest?.name || 'Unknown';

      // Check if there's an active simulated alert before updating status
      const alertSnap = await getDoc(caregiverDoc(caregiverId, 'wanderingAlerts', 'active_wandering_alert'));
      const activeAlertData = alertSnap.exists() ? alertSnap.data() : null;
      const activeSimulatedAlert = activeAlertData?.status === 'active' && activeAlertData?.isSimulated;

      // If simulated alert is active, force status to Outside Safe Location
      if (activeSimulatedAlert) {
        detailedStatus = 'Outside Safe Location';
      }

      const shouldGeocode = outside && currentLocation && (
        !lastGeocodePos ||
        getDistance(currentLocation.lat, currentLocation.lng, lastGeocodePos.lat, lastGeocodePos.lng) > 50 ||
        now - lastGeocodeTime > 30000 // Every 30 seconds if moving slowly
      );

      if (shouldGeocode) {
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentLocation.lat}&lon=${currentLocation.lng}`, {
            headers: {
              'Accept-Language': 'en',
              'User-Agent': 'MemoryLaneCompanion/1.0 (balajik3550@gmail.com)'
            }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.display_name) {
              const name = data.display_name.split(',').slice(0, 2).join(',');
              locationName = name;
              setLastGeocodeName(name);
              setLastGeocodeTime(now);
              setLastGeocodePos(currentLocation);
            }
          }
        } catch (err) {
          // Silent fail to avoid flooding console, use fallback name
          console.warn('Reverse geocoding failed, using fallback name');
        }
      }

      // Update user status
      await setDoc(caregiverDoc(caregiverId, 'userStatus', 'current'), {
        isSafe: detailedStatus === 'Safe',
        detailedStatus,
        lastUpdated: new Date().toISOString(),
        exitTimestamp,
        currentLocationName: locationName,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        distanceToSafe: minDistance === Infinity ? 0 : Math.round(minDistance)
      }).catch(err => console.error('Error updating user status:', err));

      // Handle Wandering Alert Trigger
      if (detailedStatus === 'Outside Safe Location' && !activeSimulatedAlert) {
        const alertId = 'active_wandering_alert';

        // Only trigger if not already active and notified
        if (!activeAlertData || activeAlertData.status === 'resolved' || !activeAlertData.notifiedCaregiver) {
          await setDoc(caregiverDoc(caregiverId, 'wanderingAlerts', alertId), {
            id: alertId,
            timestamp: new Date().toISOString(),
            exitTimestamp: exitTimestamp || new Date().toISOString(),
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            locationName: locationName,
            status: 'active',
            notifiedCaregiver: true,
            isSimulated: false
          });

          // Simulate Phone Call & SMS
          console.log("SIMULATED PHONE CALL: Alert: The patient has been outside a safe location for more than 10 minutes. A tracking link has been sent.");
          const trackingLink = `${window.location.origin}/track/current`;
          console.log(`SIMULATED SMS: Track patient's live location: ${trackingLink}`);
        } else {
          // Just update location for active alert
          await setDoc(caregiverDoc(caregiverId, 'wanderingAlerts', alertId), {
            timestamp: new Date().toISOString(),
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            locationName: locationName,
          }, { merge: true });
        }
      } else if (detailedStatus === 'Safe') {
        // If back in safe zone, resolve the alert if it's not simulated
        if (activeSimulatedAlert) {
          return;
        }

        await setDoc(caregiverDoc(caregiverId, 'wanderingAlerts', 'active_wandering_alert'), {
          status: 'resolved'
        }, { merge: true });
      }
    };

    updateStatus();
  }, [currentLocation, safeZones, meetings, caregiverId]);

  return null; // This component doesn't render anything
}
