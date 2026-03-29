import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { db, doc, onSnapshot, collection, handleFirestoreError, OperationType, auth, setDoc } from '../lib/firebase';
import { UserStatus, SafeZone, FamilyContact } from '../types';
import { Phone, Navigation, ArrowLeft, AlertTriangle, Shield, MapPin, Clock } from 'lucide-react';
import { motion } from 'motion/react';

// Fix for default marker icons in Leaflet
const markerIcon = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const markerShadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export function LiveTrackingPage() {
  const { patientId } = useParams();
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [contacts, setContacts] = useState<FamilyContact[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    // In this app, we only have one patient for now, so we use 'current'
    const unsubscribeStatus = onSnapshot(doc(db, 'userStatus', 'current'), (snapshot) => {
      if (snapshot.exists()) {
        setUserStatus(snapshot.data() as UserStatus);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'userStatus/current');
    });

    const unsubscribeZones = onSnapshot(collection(db, 'safeZones'), (snapshot) => {
      setSafeZones(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafeZone)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'safeZones');
    });

    const unsubscribeContacts = onSnapshot(collection(db, 'contacts'), (snapshot) => {
      setContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilyContact)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'contacts');
    });

    return () => {
      unsubscribeStatus();
      unsubscribeZones();
      unsubscribeContacts();
    };
  }, [auth.currentUser]);

  if (!userStatus) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-xl font-serif font-bold text-stone-800 mb-2">Connecting to live tracking...</h2>
          <p className="text-stone-500 italic mb-8">Waiting for the patient's device to send location data. Make sure the patient app is open and has location permissions enabled.</p>

          <div className="p-6 bg-white rounded-3xl border border-stone-200 shadow-sm">
            <p className="text-sm text-stone-600 mb-4 font-medium">Testing the app?</p>
            <button
              onClick={async () => {
                const demoLocation = {
                  lat: 37.7749,
                  lng: -122.4194,
                  locationName: "San Francisco, CA"
                };
                await setDoc(doc(db, 'userStatus', 'current'), {
                  isSafe: true,
                  lastUpdated: new Date().toISOString(),
                  currentLocationName: demoLocation.locationName,
                  lat: demoLocation.lat,
                  lng: demoLocation.lng,
                  distanceToSafe: 0
                });
              }}
              className="w-full bg-stone-900 text-white py-3 rounded-2xl font-bold hover:bg-stone-800 transition-colors"
            >
              Simulate Patient Location
            </button>
          </div>

          <Link to="/caregiver" className="mt-8 inline-block text-stone-400 hover:text-stone-600 font-medium underline underline-offset-4">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const position: [number, number] = [userStatus.lat, userStatus.lng];

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 p-4 sticky top-0 z-[1000] shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/caregiver" className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-stone-600" />
            </Link>
            <div>
              <h1 className="text-xl font-serif font-bold text-stone-900">Live Tracking</h1>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${userStatus.isSafe ? 'bg-emerald-500' : (userStatus.detailedStatus === 'Outside (Monitoring)' ? 'bg-amber-500' : 'bg-rose-500 animate-pulse')}`} />
                <span className={`text-sm font-bold uppercase tracking-wider ${userStatus.isSafe ? 'text-emerald-600' : (userStatus.detailedStatus === 'Outside (Monitoring)' ? 'text-amber-600' : 'text-rose-600')}`}>
                  {userStatus.detailedStatus || (userStatus.isSafe ? 'Safe' : 'Outside Safe Location')}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">Last Updated</p>
            <p className="text-sm font-bold text-stone-700">{new Date(userStatus.lastUpdated).toLocaleTimeString()}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row">
        {/* Map View */}
        <div className="flex-1 relative h-[50vh] lg:h-auto z-0">
          <MapContainer center={position} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapUpdater center={position} />

            {/* Safe Zones */}
            {safeZones.map(zone => (
              <Circle
                key={zone.id}
                center={[zone.lat, zone.lng]}
                radius={zone.radius}
                pathOptions={{
                  color: '#10b981',
                  fillColor: '#10b981',
                  fillOpacity: 0.1,
                  dashArray: '5, 10'
                }}
              >
                <Popup>
                  <div className="font-bold text-emerald-700">{zone.name} (Safe Zone)</div>
                </Popup>
              </Circle>
            ))}

            {/* User Marker */}
            <Marker position={position}>
              <Popup>
                <div className="p-2">
                  <p className="font-bold text-stone-900 mb-1">Patient's Location</p>
                  <p className="text-xs text-stone-500">{userStatus.currentLocationName}</p>
                </div>
              </Popup>
            </Marker>
          </MapContainer>

          {/* Map Overlay Info */}
          <div className="absolute bottom-6 left-6 right-6 lg:left-auto lg:w-80 z-[1000]">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white/90 backdrop-blur-md p-6 rounded-[32px] shadow-2xl border border-white/20"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-widest">Current Location</p>
                  <p className="font-bold text-stone-800 leading-tight">{userStatus.currentLocationName}</p>
                </div>
              </div>
              {userStatus.detailedStatus !== 'Safe' && (
                <div className={`p-3 rounded-2xl flex items-center gap-3 mb-4 border ${userStatus.detailedStatus === 'Outside (Monitoring)' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                  {userStatus.detailedStatus === 'Outside (Monitoring)' ? <Clock className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  <span className="text-sm font-bold">{userStatus.detailedStatus}</span>
                </div>
              )}
              <button
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${userStatus.lat},${userStatus.lng}`, '_blank')}
                className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-colors shadow-lg"
              >
                <Navigation className="w-5 h-5" />
                Navigate to Patient
              </button>
            </motion.div>
          </div>
        </div>

        {/* Sidebar / Controls */}
        <div className="w-full lg:w-96 bg-white border-l border-stone-200 p-6 flex flex-col gap-8 overflow-y-auto">
          <section>
            <h2 className="text-xs text-stone-400 uppercase tracking-widest mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-4">
              {contacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => window.location.href = `tel:${contact.phone}`}
                  className="flex items-center gap-4 p-4 bg-stone-50 hover:bg-stone-100 rounded-3xl border border-stone-100 transition-colors group"
                >
                  <img
                    src={contact.photoUrl}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 text-left">
                    <p className="font-bold text-stone-800">{contact.name}</p>
                    <p className="text-xs text-stone-500">Call Patient's Family</p>
                  </div>
                  <Phone className="w-5 h-5 text-stone-400 group-hover:text-rose-500 transition-colors" />
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xs text-stone-400 uppercase tracking-widest mb-4">Safe Zones</h2>
            <div className="space-y-3">
              {safeZones.map(zone => (
                <div key={zone.id} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="font-bold text-stone-800 text-sm">{zone.name}</p>
                      <p className="text-xs text-stone-400">{zone.radius}m radius</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-auto pt-6 border-t border-stone-100">
            <div className="bg-stone-900 text-white p-6 rounded-[32px] shadow-xl">
              <p className="text-xs text-stone-400 uppercase tracking-widest mb-2">Patient Safety Tip</p>
              <p className="text-sm font-serif italic text-stone-200">
                "Stay calm when calling. Use a reassuring voice and guide them to a safe landmark if possible."
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
