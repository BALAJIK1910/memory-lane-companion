import { useState, useEffect } from 'react';
import { db, collection, onSnapshot, setDoc, updateDoc, deleteDoc, doc, query, orderBy, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { Task, FamilyContact, Settings, Meeting, MeetingStep, SafeZone, UserStatus, WanderingAlert } from '../types';
import { Activity, Plus, Trash2, Save, UserPlus, Image as ImageIcon, MessageSquare, ArrowLeft, CheckCircle2, XCircle, Calendar, MapPin, ListChecks, AlertCircle, Shield, Navigation, ExternalLink, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { getDistance } from '../lib/utils';
export function CaregiverDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<FamilyContact[]>([]);
  const [settings, setSettings] = useState<Settings>({
    reassuringMessage: "You are at home. Everything is okay.",
    caregiverEmail: ""
  });

  const [newTask, setNewTask] = useState({ title: '', time: '08:00', icon: '💊' });
  const [newContact, setNewContact] = useState({ name: '', relationship: 'Family', photoUrl: '', phone: '' });
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [newMeeting, setNewMeeting] = useState({
    personName: '',
    personPhotoUrl: '',
    date: new Date().toISOString().split('T')[0], // default to today YYYY-MM-DD
    time: '12:00',
    location: '',
    lat: '' as number | string,
    lng: '' as number | string,
    steps: [] as MeetingStep[]
  });
  const [newStep, setNewStep] = useState({ text: '', icon: '✨' });

  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [newSafeZone, setNewSafeZone] = useState({ name: '', lat: 0, lng: 0, radius: 100 });
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [activeAlert, setActiveAlert] = useState<WanderingAlert | null>(null);


  const closestSafeZone = userStatus?.lat && userStatus?.lng && safeZones.length > 0
    ? safeZones.reduce((prev, curr) => {
      const prevDist = getDistance(userStatus.lat!, userStatus.lng!, prev.lat, prev.lng);
      const currDist = getDistance(userStatus.lat!, userStatus.lng!, curr.lat, curr.lng);
      return prevDist < currDist ? prev : curr;
    })
    : null;

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'tasks'), orderBy('time', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'tasks');
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = onSnapshot(collection(db, 'contacts'), (snapshot) => {
      setContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilyContact)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'contacts');
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as Settings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = onSnapshot(collection(db, 'meetings'), (snapshot) => {
      const fetchedMeetings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meeting));
      // Sort client-side by date+time combined (fallback '0000-00-00' for legacy meetings without a date)
      fetchedMeetings.sort((a, b) => {
        const aKey = `${a.date || '0000-00-00'} ${a.time || '00:00'}`;
        const bKey = `${b.date || '0000-00-00'} ${b.time || '00:00'}`;
        return aKey.localeCompare(bKey);
      });
      setMeetings(fetchedMeetings);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'meetings');
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = onSnapshot(collection(db, 'safeZones'), (snapshot) => {
      setSafeZones(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafeZone)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'safeZones');
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = onSnapshot(doc(db, 'userStatus', 'current'), (snapshot) => {
      if (snapshot.exists()) {
        setUserStatus(snapshot.data() as UserStatus);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'userStatus/current');
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = onSnapshot(doc(db, 'wanderingAlerts', 'active_wandering_alert'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as WanderingAlert;
        if (data.status === 'active') {
          // Use a functional update to check previous state without depending on it
          setActiveAlert(prev => {
            if (!prev || prev.status !== 'active' || prev.timestamp !== data.timestamp) {
              if (!prev || prev.status !== 'active') {
                toast.error("WANDERING ALERT: Patient has left safe zone!", {
                  description: `Location: ${data.locationName}`,
                  duration: Infinity,
                  action: {
                    label: "Track Now",
                    onClick: () => window.location.href = "/track/current"
                  }
                });
              }
              return data;
            }
            return prev;
          });
        } else {
          setActiveAlert(null);
        }
      } else {
        setActiveAlert(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'wanderingAlerts/active_wandering_alert');
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  const resolveAlert = async () => {
    await setDoc(doc(db, 'wanderingAlerts', 'active_wandering_alert'), {
      status: 'resolved'
    }, { merge: true });
    await updateDoc(doc(db, 'userStatus', 'current'), {
      isSafe: true,
      detailedStatus: 'Safe',
      exitTimestamp: null
    });
    toast.success("Alert resolved. Patient status updated to safe.");
  };

  const addSafeZone = async () => {
    if (!newSafeZone.name || !newSafeZone.lat || !newSafeZone.lng) return;
    const id = Math.random().toString(36).substr(2, 9);
    await setDoc(doc(db, 'safeZones', id), { ...newSafeZone, id });
    setNewSafeZone({ name: '', lat: 0, lng: 0, radius: 100 });
  };

  const deleteSafeZone = async (id: string) => {
    await deleteDoc(doc(db, 'safeZones', id));
  };

  const getCurrentLocationForSafeZone = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setNewSafeZone(prev => ({
          ...prev,
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }));
      });
    }
  };

  const addTask = async () => {
    if (!newTask.title) return;
    const id = Math.random().toString(36).substr(2, 9);
    await setDoc(doc(db, 'tasks', id), { ...newTask, completed: false });
    setNewTask({ title: '', time: '08:00', icon: '💊' });
  };

  const addContact = async () => {
    if (!newContact.name || !newContact.photoUrl) return;
    const id = Math.random().toString(36).substr(2, 9);
    await setDoc(doc(db, 'contacts', id), newContact);
    setNewContact({ name: '', relationship: 'Family', photoUrl: '', phone: '' });
  };

  const addMeeting = async () => {
    if (!newMeeting.personName || !newMeeting.time || !newMeeting.location) return;
    const id = Math.random().toString(36).substr(2, 9);
    const meetingData: any = {
      personName: newMeeting.personName,
      personPhotoUrl: newMeeting.personPhotoUrl,
      date: newMeeting.date, // YYYY-MM-DD
      time: newMeeting.time,
      location: newMeeting.location,
      steps: newMeeting.steps,
      status: 'not-started',
      id
    };
    const parsedLat = parseFloat(newMeeting.lat.toString());
    const parsedLng = parseFloat(newMeeting.lng.toString());
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      meetingData.lat = parsedLat;
      meetingData.lng = parsedLng;
    }
    await setDoc(doc(db, 'meetings', id), meetingData);
    setNewMeeting({
      personName: '',
      personPhotoUrl: '',
      date: new Date().toISOString().split('T')[0], // reset to today
      time: '12:00',
      location: '',
      lat: '',
      lng: '',
      steps: []
    });
  };

  const addStepToMeeting = () => {
    if (!newStep.text) return;
    const step: MeetingStep = {
      id: Math.random().toString(36).substr(2, 9),
      text: newStep.text,
      icon: newStep.icon
    };
    setNewMeeting({
      ...newMeeting,
      steps: [...newMeeting.steps, step]
    });
    setNewStep({ text: '', icon: '✨' });
  };

  const removeStepFromMeeting = (stepId: string) => {
    setNewMeeting({
      ...newMeeting,
      steps: newMeeting.steps.filter(s => s.id !== stepId)
    });
  };

  const updateSettings = async () => {
    await setDoc(doc(db, 'settings', 'global'), settings);
  };

  const resetTasks = async () => {
    for (const task of tasks) {
      await updateDoc(doc(db, 'tasks', task.id), { completed: false });
    }
  };

  const seedData = async () => {
    const defaultTasks = [
      { title: 'Take Morning Medicine', time: '08:00', icon: '💊', completed: false },
      { title: 'Eat Breakfast', time: '08:30', icon: '🍎', completed: false },
      { title: 'Drink Water', time: '11:00', icon: '💧', completed: false },
      { title: 'Go for a Walk', time: '16:00', icon: '🚶', completed: false },
    ];
    const defaultContacts = [
      { name: 'Daughter Sarah', photoUrl: 'https://picsum.photos/seed/sarah/400/400', phone: '555-0101' },
      { name: 'Son Michael', photoUrl: 'https://picsum.photos/seed/michael/400/400', phone: '555-0102' },
    ];
    const defaultMeeting = {
      personName: 'Priya',
      personPhotoUrl: 'https://picsum.photos/seed/priya/400/400',
      time: '16:00',
      location: 'At the hospital',
      status: 'not-started',
      steps: [
        { id: '1', text: 'Pick up your bag', icon: '👜' },
        { id: '2', text: 'Go outside', icon: '🚪' },
        { id: '3', text: 'Wait for your ride', icon: '🚗' }
      ]
    };

    for (const t of defaultTasks) {
      const id = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'tasks', id), t);
    }
    for (const c of defaultContacts) {
      const id = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'contacts', id), c);
    }
    const meetingId = Math.random().toString(36).substr(2, 9);
    await setDoc(doc(db, 'meetings', meetingId), defaultMeeting);
    await setDoc(doc(db, 'settings', 'global'), {
      reassuringMessage: "You are at home. Everything is okay.",
      caregiverEmail: "balajik3550@gmail.com"
    });
  };

  return (
    <div className="min-h-screen max-w-6xl mx-auto p-6 pt-24 pb-24">
      {/* Active Wandering Alert */}
      {activeAlert && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-12 bg-rose-600 text-white p-8 rounded-[40px] shadow-2xl shadow-rose-200 border-4 border-rose-400 flex flex-col md:flex-row items-center justify-between gap-8"
        >
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center animate-pulse">
              <AlertCircle className="w-12 h-12 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-serif font-bold mb-2">Wandering Alert!</h2>
              <p className="text-rose-100 text-lg">
                The patient is currently at <span className="font-bold text-white underline">{activeAlert.locationName}</span>
              </p>
              <p className="text-rose-200 text-sm mt-1">Alert triggered at {new Date(activeAlert.timestamp).toLocaleTimeString()}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <Link
              to={`/track/current`}
              className="flex-1 sm:flex-none bg-white text-rose-600 px-8 py-4 rounded-2xl font-bold hover:bg-rose-50 transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              <ExternalLink className="w-5 h-5" />
              Live Tracking
            </Link>
            <button
              onClick={resolveAlert}
              className="flex-1 sm:flex-none bg-rose-700 text-white px-8 py-4 rounded-2xl font-bold hover:bg-rose-800 transition-colors border border-rose-500"
            >
              Mark as Resolved
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between mb-12">
        <div>
          <Link to="/" className="flex items-center gap-2 text-stone-500 hover:text-stone-800 mb-4 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Back to Patient View
          </Link>
          <h1 className="text-4xl font-serif font-bold text-stone-900">Caregiver Dashboard</h1>
          <p className="text-stone-500">Manage routines and contacts for your loved one.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={seedData}
            className="bg-stone-100 text-stone-600 px-6 py-3 rounded-2xl font-bold hover:bg-stone-200 transition-colors"
          >
            Seed Initial Data
          </button>
          <button
            onClick={resetTasks}
            className="bg-stone-800 text-white px-6 py-3 rounded-2xl font-bold hover:bg-stone-700 transition-colors shadow-lg"
          >
            Reset Daily Tasks
          </button>
          <button
            onClick={async () => {
              const id = 'active_wandering_alert';
              const currentLat = userStatus?.lat || 37.7749;
              const currentLng = userStatus?.lng || -122.4194;
              const now = new Date().toISOString();

              await setDoc(doc(db, 'wanderingAlerts', id), {
                id,
                timestamp: now,
                exitTimestamp: now,
                lat: currentLat + 0.005, // Offset to simulate being outside
                lng: currentLng + 0.005,
                locationName: "Simulated Wandering Location",
                status: 'active',
                notifiedCaregiver: true,
                isSimulated: true
              });
              await updateDoc(doc(db, 'userStatus', 'current'), {
                isSafe: false,
                detailedStatus: 'Outside Safe Location',
                exitTimestamp: now,
                lat: currentLat + 0.005,
                lng: currentLng + 0.005,
                currentLocationName: "Simulated Wandering Location"
              });
              toast.info("Simulation started: Patient marked as wandering.");
            }}
            className="bg-rose-100 text-rose-600 px-6 py-3 rounded-2xl font-bold hover:bg-rose-200 transition-colors border border-rose-200"
          >
            Simulate Wandering
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Routine Management */}
        <section className="col-span-1 h-full">
          <div className="bg-white p-6 rounded-[24px] shadow-sm border border-stone-100 flex flex-col h-[600px]">
            <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Daily Routine
            </h2>

            <div className="space-y-3 mb-6 shrink-0">
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Task (e.g. Medicine)"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none text-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={newTask.time}
                    onChange={e => setNewTask({ ...newTask, time: e.target.value })}
                    className="flex-1 p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none text-sm"
                  />
                  <select
                    value={newTask.icon}
                    onChange={e => setNewTask({ ...newTask, icon: e.target.value })}
                    className="w-16 p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none text-sm"
                  >
                    <option value="💊">💊</option>
                    <option value="🍎">🍎</option>
                    <option value="💧">💧</option>
                    <option value="🚶">🚶</option>
                    <option value="🛏️">🛏️</option>
                    <option value="🚿">🚿</option>
                  </select>
                  <button
                    onClick={addTask}
                    className="bg-stone-800 text-white p-2.5 rounded-xl hover:bg-stone-700 w-12 flex justify-center items-center shrink-0"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 pr-2 custom-scrollbar">
              {tasks.map(task => (
                <div key={task.id} className="flex flex-col gap-2 p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{task.icon}</span>
                      <div>
                        <p className="font-bold text-stone-800 text-sm">{task.title}</p>
                        <p className="text-xs text-stone-500">{task.time}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteDoc(doc(db, 'tasks', task.id))}
                      className="text-stone-300 hover:text-rose-500 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex justify-end">
                    {task.completed ? (
                      <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">Completed</span>
                    ) : (
                      <span className="bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">Pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Meeting Assistant */}
        <section className="col-span-1 h-full">
          <div className="bg-white p-6 rounded-[24px] shadow-sm border border-stone-100 flex flex-col h-[600px]">
            <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2 text-rose-500">
              <Calendar className="w-5 h-5" />
              Meetings
            </h2>

            <div className="space-y-3 mb-6 bg-stone-50 p-4 rounded-xl border border-stone-100 shrink-0">
              <input
                type="text"
                placeholder="Person's Name"
                value={newMeeting.personName}
                onChange={e => setNewMeeting({ ...newMeeting, personName: e.target.value })}
                className="w-full p-2.5 bg-white border border-stone-200 rounded-xl outline-none text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={newMeeting.date}
                  onChange={e => setNewMeeting({ ...newMeeting, date: e.target.value })}
                  className="p-2.5 bg-white border border-stone-200 rounded-xl outline-none text-sm"
                />
                <input
                  type="time"
                  value={newMeeting.time}
                  onChange={e => setNewMeeting({ ...newMeeting, time: e.target.value })}
                  className="p-2.5 bg-white border border-stone-200 rounded-xl outline-none text-sm"
                />
              </div>
              <div className="relative">
                 <ImageIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-stone-400" />
                 <input
                   type="url"
                   placeholder="Photo URL (optional)"
                   value={newMeeting.personPhotoUrl}
                   onChange={e => setNewMeeting({ ...newMeeting, personPhotoUrl: e.target.value })}
                   className="w-full p-2.5 pl-8 bg-white border border-stone-200 rounded-xl outline-none text-sm"
                 />
              </div>
              <input
                type="text"
                placeholder="Location Name"
                value={newMeeting.location}
                onChange={e => setNewMeeting({ ...newMeeting, location: e.target.value })}
                className="w-full p-2.5 bg-white border border-stone-200 rounded-xl outline-none text-sm"
              />
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="Lat (optional)"
                    value={newMeeting.lat}
                    onChange={e => setNewMeeting({ ...newMeeting, lat: e.target.value })}
                    className="p-2.5 bg-white border border-stone-200 rounded-xl outline-none text-sm"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Lng (optional)"
                    value={newMeeting.lng}
                    onChange={e => setNewMeeting({ ...newMeeting, lng: e.target.value })}
                    className="p-2.5 bg-white border border-stone-200 rounded-xl outline-none text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.geolocation) {
                       navigator.geolocation.getCurrentPosition((position) => {
                          setNewMeeting(prev => ({
                             ...prev,
                             lat: position.coords.latitude.toFixed(6),
                             lng: position.coords.longitude.toFixed(6)
                          }));
                       });
                    }
                  }}
                  className="bg-white border border-stone-200 text-stone-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-stone-50 transition-colors flex items-center justify-center gap-1 w-full"
                >
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  Use Current Location
                </button>
              </div>

              <button
                onClick={addMeeting}
                className="w-full bg-rose-500 text-white p-2.5 rounded-xl hover:bg-rose-600 font-bold shadow-sm transition-all text-sm mt-2"
              >
                Schedule Meeting
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar">
              {meetings.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-stone-400">
                  <p className="text-sm italic">No meetings scheduled.</p>
                </div>
              )}
              {meetings.map(meeting => (
                <div key={meeting.id} className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-stone-200 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                         {meeting.personPhotoUrl ? (
                           <img src={meeting.personPhotoUrl} alt="" className="w-full h-full object-cover" />
                         ) : (
                           <span className="text-sm font-bold text-stone-500">{meeting.personName?.charAt(0) || '?'}</span>
                         )}
                      </div>
                      <div>
                        <p className="font-bold text-stone-800 text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">{meeting.personName}</p>
                        <p className="text-xs text-stone-500">{meeting.date || 'No date'} · {meeting.time}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteDoc(doc(db, 'meetings', meeting.id))}
                      className="text-stone-300 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-200/50">
                    <span className="text-[10px] text-stone-500 flex items-center gap-1 overflow-hidden" title={meeting.location}>
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[100px]">{meeting.location}</span>
                    </span>
                    {meeting.status === 'completed' && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0">Done</span>}
                    {meeting.status === 'not-started' && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0">Pending</span>}
                    {meeting.status === 'in-progress' && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0">Active</span>}
                    {meeting.status === 'missed' && <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 shrink-0"><AlertCircle className="w-3 h-3" /> Missed</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Global Settings */}
        <section className="col-span-1 h-full">
          <div className="bg-white p-6 rounded-[24px] shadow-sm border border-stone-100 flex flex-col h-[600px]">
            <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-rose-400" />
              Reassuring Message
            </h2>
            <textarea
              value={settings.reassuringMessage}
              onChange={e => setSettings({ ...settings, reassuringMessage: e.target.value })}
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none flex-1 mb-4 text-sm resize-none"
              placeholder="Message that appears on the patient's screen..."
            />
            <button
              onClick={updateSettings}
              className="flex items-center justify-center gap-2 w-full bg-stone-800 text-white px-4 py-2.5 rounded-xl hover:bg-stone-700 transition-colors text-sm font-bold"
            >
              <Save className="w-4 h-4" />
              Save Message
            </button>
          </div>
        </section>

        {/* Family Contacts Management */}
        <section className="col-span-1 h-full">
          <div className="bg-white p-6 rounded-[24px] shadow-sm border border-stone-100 h-[600px] flex flex-col">
            <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-400" />
              Family Contacts
            </h2>

            <div className="space-y-3 mb-4 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={newContact.name}
                  onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                  className="flex-1 p-2.5 bg-stone-50 border border-stone-200 rounded-xl outline-none text-sm"
                />
                <select
                  value={newContact.relationship}
                  onChange={e => setNewContact({ ...newContact, relationship: e.target.value })}
                  className="flex-1 p-2.5 bg-stone-50 border border-stone-200 rounded-xl outline-none text-sm"
                >
                  <option value="Family">Family</option>
                  <option value="Daughter">Daughter</option>
                  <option value="Son">Son</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Brother">Brother</option>
                  <option value="Sister">Sister</option>
                  <option value="Caregiver">Caregiver</option>
                  <option value="Doctor">Doctor</option>
                  <option value="Friend">Friend</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Phone"
                  value={newContact.phone}
                  onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                  className="flex-1 p-2.5 bg-stone-50 border border-stone-200 rounded-xl outline-none text-sm"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <ImageIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Photo URL"
                    value={newContact.photoUrl}
                    onChange={e => setNewContact({ ...newContact, photoUrl: e.target.value })}
                    className="w-full p-2.5 pl-8 bg-stone-50 border border-stone-200 rounded-xl outline-none text-sm"
                  />
                </div>
                <button
                  onClick={addContact}
                  className="bg-stone-800 text-white px-4 py-2.5 rounded-xl hover:bg-stone-700 font-bold text-sm shrink-0 whitespace-nowrap"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto pr-2 flex-1 custom-scrollbar">
              {contacts.map(contact => (
                <div key={contact.id} className="relative group rounded-xl overflow-hidden border border-stone-100 shadow-sm flex flex-col h-[140px]">
                  <img
                    src={contact.photoUrl}
                    alt={contact.name}
                    className="w-full h-20 object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="p-2 bg-white flex-1 flex flex-col justify-center">
                    <p className="font-bold text-stone-800 text-xs truncate" title={contact.name}>{contact.name}</p>
                    {contact.relationship && (
                      <span className="inline-block mt-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full w-fit">
                        {contact.relationship}
                      </span>
                    )}
                    <p className="text-[10px] text-stone-500 truncate mt-0.5" title={contact.phone}>{contact.phone || 'No phone'}</p>
                  </div>
                  <button
                    onClick={() => deleteDoc(doc(db, 'contacts', contact.id))}
                    className="absolute top-1 right-1 p-1.5 bg-white/90 backdrop-blur-sm rounded-full text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Safe Location Awareness */}
        <section className="col-span-1 lg:col-span-2 h-full">
          <div className="bg-white p-6 rounded-[24px] shadow-sm border border-stone-100 flex flex-col h-full">
            <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              Safe Location Awareness
            </h2>

            {/* User Status Card */}
            <div className={`p-4 rounded-2xl mb-6 border-2 transition-all shrink-0 ${userStatus?.isSafe ? 'bg-emerald-50 border-emerald-100' : (userStatus?.detailedStatus === 'Outside (Monitoring)' ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100 animate-pulse')}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${userStatus?.isSafe ? 'bg-emerald-500' : (userStatus?.detailedStatus === 'Outside (Monitoring)' ? 'bg-amber-500' : 'bg-rose-500')}`} />
                  <h3 className="font-bold text-stone-800 text-sm">Patient Status</h3>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${userStatus?.isSafe ? 'bg-emerald-100 text-emerald-700' : (userStatus?.detailedStatus === 'Outside (Monitoring)' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}`}>
                  {userStatus?.detailedStatus || (userStatus?.isSafe ? 'Safe' : 'Outside Safe Zone')}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-stone-600 text-sm">
                  <MapPin className="w-4 h-4" />
                  <span className="font-medium">{userStatus?.currentLocationName || 'Locating...'}</span>
                  {userStatus?.detailedStatus !== 'Safe' && userStatus?.distanceToSafe && (
                    <span className={`font-bold ${userStatus?.detailedStatus === 'Outside (Monitoring)' ? 'text-amber-500' : 'text-rose-500'}`}>
                      ({userStatus.distanceToSafe}m from {closestSafeZone?.name || 'safe zone'})
                    </span>
                  )}
                </div>
                {userStatus?.exitTimestamp && (
                  <div className="flex items-center gap-2 text-stone-500 text-xs">
                    <Clock className="w-3 h-3" />
                    <span>Left safe zone at {new Date(userStatus.exitTimestamp).toLocaleTimeString()}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-stone-400 text-xs">
                  <Activity className="w-3 h-3" />
                  <span>Last update: {new Date(userStatus?.lastUpdate || Date.now()).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            {/* Add Safe Zone Form */}
            <div className="space-y-3 mb-6 p-4 bg-stone-50 rounded-xl border border-stone-100 shrink-0">
              <h3 className="font-bold text-stone-800 mb-2 text-sm">Add New Safe Zone</h3>
              <input
                type="text"
                placeholder="Zone Name (e.g. Home)"
                value={newSafeZone.name}
                onChange={e => setNewSafeZone({ ...newSafeZone, name: e.target.value })}
                className="w-full p-2.5 bg-white border border-stone-200 rounded-xl outline-none text-sm mb-2"
              />
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="number"
                  placeholder="Lat"
                  value={newSafeZone.lat || ''}
                  onChange={e => setNewSafeZone({ ...newSafeZone, lat: parseFloat(e.target.value) })}
                  className="p-2.5 bg-white border border-stone-200 rounded-xl outline-none text-sm"
                />
                <input
                  type="number"
                  placeholder="Lng"
                  value={newSafeZone.lng || ''}
                  onChange={e => setNewSafeZone({ ...newSafeZone, lng: parseFloat(e.target.value) })}
                  className="p-2.5 bg-white border border-stone-200 rounded-xl outline-none text-sm"
                />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-stone-500 whitespace-nowrap">Radius (m):</span>
                <input
                  type="number"
                  value={newSafeZone.radius}
                  onChange={e => setNewSafeZone({ ...newSafeZone, radius: parseInt(e.target.value) })}
                  className="flex-1 p-2 bg-white border border-stone-200 rounded-xl outline-none text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={getCurrentLocationForSafeZone}
                  className="flex-1 bg-stone-200 text-stone-700 p-2 rounded-xl hover:bg-stone-300 font-bold flex items-center justify-center gap-1 text-sm transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  My Loc
                </button>
                <button
                  onClick={addSafeZone}
                  className="flex-1 bg-emerald-500 text-white p-2 rounded-xl hover:bg-emerald-600 font-bold shadow-sm transition-colors text-sm"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Safe Zones List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pr-2 flex-1 custom-scrollbar min-h-[150px]">
              {safeZones.map(zone => (
                <div key={zone.id} className="p-3 bg-white border border-stone-100 rounded-xl flex items-center justify-between shadow-sm h-[60px]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-stone-800 text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]" title={zone.name}>{zone.name}</p>
                      <p className="text-[10px] text-stone-500">{zone.radius}m • {zone.lat.toFixed(3)}, {zone.lng.toFixed(3)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteSafeZone(zone.id)}
                    className="text-stone-300 hover:text-rose-500 p-1.5 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
