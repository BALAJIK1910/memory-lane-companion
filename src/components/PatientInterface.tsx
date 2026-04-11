import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { caregiverCol, caregiverDoc, onSnapshot, query, orderBy, updateDoc, where, handleFirestoreError, OperationType, setDoc } from '../lib/firebase';
import { Task, FamilyContact, Settings, Meeting, MeetingStep, SafeZone, UserStatus } from '../types';
import { Phone, Volume2, CheckCircle2, Heart, Clock, Calendar as CalendarIcon, MapPin, User, ArrowRight, ArrowLeft, Check, AlertTriangle, UserPlus } from 'lucide-react';
import { differenceInMinutes, parseISO, startOfToday } from 'date-fns';
import { getDistance } from '../lib/utils';
import { useUser } from '../contexts/UserContext';

export function PatientInterface() {
  const { caregiverId } = useUser();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<FamilyContact[]>([]);
  const [settings, setSettings] = useState<Settings>({
    reassuringMessage: "You are at home. Everything is okay.",
    caregiverEmail: ""
  });
  const [activeReminder, setActiveReminder] = useState<Task | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);

  const [timeOfDay, setTimeOfDay] = useState("morning");

  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const isOutsideSafeZone = userStatus ? (userStatus.detailedStatus === 'Outside Safe Location') : false;
  const isAlertActive = userStatus?.detailedStatus === 'Outside Safe Location';
  const closestSafeZoneName = userStatus?.currentLocationName || 'Unknown';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) setTimeOfDay("morning");
    else if (hour >= 12 && hour < 17) setTimeOfDay("afternoon");
    else setTimeOfDay("evening");
  }, [currentTime]);

  useEffect(() => {
    if (!caregiverId) return;
    const q = query(caregiverCol(caregiverId, 'tasks'), orderBy('time', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(taskList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `caregivers/${caregiverId}/tasks`);
    });
    return () => unsubscribe();
  }, [caregiverId]);

  useEffect(() => {
    if (!caregiverId) return;
    const unsubscribe = onSnapshot(caregiverCol(caregiverId, 'contacts'), (snapshot) => {
      const contactList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilyContact));
      setContacts(contactList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `caregivers/${caregiverId}/contacts`);
    });
    return () => unsubscribe();
  }, [caregiverId]);

  useEffect(() => {
    if (!caregiverId) return;
    const unsubscribe = onSnapshot(caregiverDoc(caregiverId, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as Settings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `caregivers/${caregiverId}/settings/global`);
    });
    return () => unsubscribe();
  }, [caregiverId]);

  useEffect(() => {
    if (!caregiverId) return;
    const q = query(
      caregiverCol(caregiverId, 'meetings'),
      where('status', 'in', ['not-started', 'in-progress'])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const meetingList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Meeting))
        // Only show today's meetings; meetings without a date are treated as today (backward compat)
        .filter(m => !m.date || m.date === todayStr)
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      setMeetings(meetingList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `caregivers/${caregiverId}/meetings`);
    });
    return () => unsubscribe();
  }, [caregiverId]);

  useEffect(() => {
    if (!caregiverId) return;
    const unsubscribe = onSnapshot(caregiverDoc(caregiverId, 'userStatus', 'current'), (snapshot) => {
      if (snapshot.exists()) {
        setUserStatus(snapshot.data() as UserStatus);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `caregivers/${caregiverId}/userStatus/current`);
    });
    return () => unsubscribe();
  }, [caregiverId]);

  // Handle voice guidance for wandering
  useEffect(() => {
    if (isOutsideSafeZone) {
      const speakGuidance = () => {
        const message = isAlertActive
          ? "You are not in a familiar place. Your family has been notified and they are coming to help you. Please stay where you are."
          : "You are not in a familiar place. Please stay where you are, or press the button to call your family.";
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      };

      speakGuidance();
      const interval = setInterval(speakGuidance, 30000); // Repeat every 30 seconds
      return () => {
        clearInterval(interval);
        window.speechSynthesis.cancel();
      };
    }
  }, [isOutsideSafeZone]);

  // Check for meeting reminders
  useEffect(() => {
    const checkMeetingReminders = () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      meetings.forEach(async (meeting) => {
        // Skip reminder if this meeting is not scheduled for today
        if (meeting.date && meeting.date !== todayStr) return;

        const [hours, minutes] = meeting.time.split(':').map(Number);
        const meetingDate = new Date();
        meetingDate.setHours(hours, minutes, 0, 0);

        const diff = differenceInMinutes(meetingDate, now);
        const reminderIntervals = [60, 30, 10];

        if (reminderIntervals.includes(diff)) {
          const lastNotified = meeting.lastNotified ? new Date(meeting.lastNotified) : null;
          const alreadyNotified = lastNotified && differenceInMinutes(now, lastNotified) < 2;

          if (!alreadyNotified) {
            const message = `You have a meeting with ${meeting.personName} at ${meeting.time}. Please get ready.`;
            playVoiceInstruction(message);
            await updateDoc(caregiverDoc(caregiverId, 'meetings', meeting.id), {
              lastNotified: now.toISOString()
            });
          }
        }

        // Location awareness check
        let isAtMeeting = false;
        if (meeting.lat && meeting.lng && userStatus?.lat && userStatus?.lng) {
          const distance = getDistance(userStatus.lat, userStatus.lng, meeting.lat, meeting.lng);
          if (distance <= 50) {
            isAtMeeting = true;
          }
        }

        // Auto-mark as in-progress if they arrived within a reasonable window
        if (isAtMeeting && diff > -120 && diff <= 30 && meeting.status === 'not-started') {
          await updateDoc(caregiverDoc(caregiverId, 'meetings', meeting.id), { status: 'in-progress' });
          playVoiceInstruction("You have arrived at your meeting.");
        } else if (diff < -30 && meeting.status === 'not-started') {
          // Auto-mark as missed if 30 mins past
          await updateDoc(caregiverDoc(caregiverId, 'meetings', meeting.id), { status: 'missed' });
        }
      });
    };

    const interval = setInterval(checkMeetingReminders, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [meetings, userStatus, caregiverId]);

  // Check for reminders every minute
  useEffect(() => {
    const checkReminders = () => {
      const nowStr = format(currentTime, 'HH:mm');
      const taskToRemind = tasks.find(t => t.time === nowStr && !t.completed);
      if (taskToRemind && activeReminder?.id !== taskToRemind.id) {
        setActiveReminder(taskToRemind);
        playVoiceInstruction(taskToRemind.title);
      }
    };
    checkReminders();
  }, [currentTime, tasks, activeReminder]);

  const playVoiceInstruction = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.8;
    utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const handleCompleteTask = async (taskId: string) => {
    await updateDoc(caregiverDoc(caregiverId, 'tasks', taskId), { completed: true });
    setActiveReminder(null);
  };

  const startMeetingGuidance = (meeting: Meeting) => {
    setActiveMeeting(meeting);
    setCurrentStepIndex(0);
    if (meeting.steps.length > 0) {
      playVoiceInstruction(meeting.steps[0].text);
    }
  };

  const nextStep = () => {
    if (activeMeeting && currentStepIndex < activeMeeting.steps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      playVoiceInstruction(activeMeeting.steps[nextIdx].text);
    } else if (activeMeeting) {
      completeMeeting();
    }
  };

  const completeMeeting = async () => {
    if (activeMeeting) {
      await updateDoc(caregiverDoc(caregiverId, 'meetings', activeMeeting.id), { status: 'completed' });
      setActiveMeeting(null);
      setCurrentStepIndex(-1);
      playVoiceInstruction("Great job! You are ready for your meeting.");
    }
  };

  const currentTasks = tasks.filter(t => !t.completed).slice(0, 2);
  const upcomingMeeting = meetings.find(m => m.status === 'not-started' || m.status === 'in-progress');

  return (
    <div className="min-h-screen p-8 lg:p-12">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
        <div className="mb-6 md:mb-0">
          <div className="flex items-center gap-4 text-stone-500 mb-2">
            <CalendarIcon className="w-8 h-8" />
            <span className="text-3xl font-medium uppercase tracking-widest">
              {format(currentTime, 'EEEE, MMMM do')}
            </span>
          </div>
          <div className="flex items-center gap-4 text-stone-900">
            <Clock className="w-12 h-12" />
            <span className="text-8xl font-serif font-bold tracking-tighter">
              {format(currentTime, 'HH:mm')}
            </span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 border border-rose-100 p-8 rounded-[40px] max-w-md"
        >
          <div className="flex items-center gap-4 mb-2 text-rose-500">
            <Heart className="w-8 h-8 fill-current" />
            <span className="text-xl font-bold uppercase tracking-wider">Good {timeOfDay}</span>
          </div>
          <p className="text-3xl font-serif italic text-stone-800 leading-tight">
            "{settings.reassuringMessage}"
          </p>
        </motion.div>
      </header>

      {/* Main Content Area */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Tasks & Meetings */}
        <div className="lg:col-span-7 flex flex-col gap-12">

          {/* Meeting Assistant Card */}
          {upcomingMeeting && (
            <section className="flex flex-col gap-6">
              <h2 className="text-4xl font-serif font-bold text-stone-800 flex items-center gap-4">
                Upcoming Meeting
              </h2>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border-4 border-rose-200 rounded-[48px] p-8 shadow-2xl overflow-hidden relative"
              >
                <div className="flex flex-col md:flex-row gap-8 items-center">
                  <div className="w-48 h-48 rounded-[40px] overflow-hidden border-4 border-stone-100 shadow-lg">
                    <img
                      src={upcomingMeeting.personPhotoUrl || 'https://picsum.photos/seed/person/400/400'}
                      alt={upcomingMeeting.personName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-5xl font-serif font-bold text-stone-900 mb-4">
                      Meeting with {upcomingMeeting.personName}
                    </h3>
                    <div className="flex flex-wrap justify-center md:justify-start gap-6 text-stone-600 mb-8">
                      <div className="flex items-center gap-3 bg-stone-100 py-3 px-6 rounded-2xl">
                        <CalendarIcon className="w-8 h-8 text-rose-500" />
                        <span className="text-3xl font-bold">
                          {upcomingMeeting.date
                            ? format(new Date(upcomingMeeting.date + 'T00:00:00'), 'MMMM d')
                            : 'Today'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 bg-stone-100 py-3 px-6 rounded-2xl">
                        <Clock className="w-8 h-8 text-rose-500" />
                        <span className="text-3xl font-bold">At {upcomingMeeting.time}</span>
                      </div>
                      <div className="flex items-center gap-3 bg-stone-100 py-3 px-6 rounded-2xl">
                        <MapPin className="w-8 h-8 text-rose-500" />
                        <span className="text-3xl font-bold">{upcomingMeeting.location}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => startMeetingGuidance(upcomingMeeting)}
                      className="w-full md:w-auto bg-rose-500 hover:bg-rose-600 text-white py-6 px-12 rounded-[32px] text-4xl font-bold shadow-xl transition-all flex items-center justify-center gap-4 group"
                    >
                      GO NOW
                      <ArrowRight className="w-10 h-10 group-hover:translate-x-2 transition-transform" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </section>
          )}

          {/* Tasks Section */}
          <div className="flex flex-col gap-8">
            <h2 className="text-4xl font-serif font-bold text-stone-800 flex items-center gap-4">
              Today's Routine
              {currentTasks.length === 0 && <span className="text-stone-400 font-normal text-2xl">— All done!</span>}
            </h2>

            <div className="flex flex-col gap-6 pr-4">
              <AnimatePresence mode="popLayout">
                {currentTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`p-8 rounded-[48px] border-4 transition-all ${activeReminder?.id === task.id
                      ? 'bg-amber-50 border-amber-400 shadow-2xl scale-105'
                      : 'bg-white border-stone-100 shadow-xl'
                      }`}
                  >
                    <div className="flex items-center gap-8">
                      <div className={`w-32 h-32 rounded-full flex items-center justify-center text-5xl ${activeReminder?.id === task.id ? 'bg-amber-200 text-amber-700' : 'bg-stone-100 text-stone-600'
                        }`}>
                        {task.icon || '📝'}
                      </div>
                      <div className="flex-1">
                        <span className="text-2xl font-bold text-stone-400 uppercase tracking-widest block mb-1">
                          At {task.time}
                        </span>
                        <h3 className="text-5xl font-serif font-bold text-stone-900 mb-4">{task.title}</h3>
                        <div className="flex gap-4">
                          <button
                            onClick={() => playVoiceInstruction(`It is time to ${task.title}`)}
                            className="flex items-center gap-3 bg-stone-100 hover:bg-stone-200 text-stone-700 py-4 px-8 rounded-3xl text-2xl font-bold transition-colors"
                          >
                            <Volume2 className="w-8 h-8" />
                            Listen
                          </button>
                          <button
                            onClick={() => handleCompleteTask(task.id)}
                            className="flex items-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white py-4 px-8 rounded-3xl text-2xl font-bold transition-colors shadow-lg"
                          >
                            <CheckCircle2 className="w-8 h-8" />
                            I've Done It
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {tasks.length === 0 && (
                <div className="flex items-center justify-center border-4 border-dashed border-stone-200 rounded-[48px] p-12">
                  <p className="text-3xl text-stone-400 font-serif italic">No tasks scheduled for today.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Family Section */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          <h2 className="text-4xl font-serif font-bold text-stone-800">Call Family</h2>
          <div className="grid grid-cols-2 gap-6">
            {contacts.map((contact) => (
              <motion.button
                key={contact.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group relative aspect-square rounded-[48px] overflow-hidden shadow-xl border-4 border-white"
              >
                <img
                  src={contact.photoUrl}
                  alt={contact.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-6">
                  <span className="text-white text-3xl font-serif font-bold mb-1">{contact.name}</span>
                  {contact.relationship && (
                    <span className="text-rose-200 text-lg font-medium mb-2">{contact.relationship}</span>
                  )}
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md py-2 px-4 rounded-2xl self-start">
                    <Phone className="w-5 h-5 text-white" />
                    <span className="text-white text-lg font-bold">Call Now</span>
                  </div>
                </div>
              </motion.button>
            ))}
            {contacts.length === 0 && (
              <div className="col-span-2 aspect-[2/1] flex items-center justify-center border-4 border-dashed border-stone-200 rounded-[48px]">
                <p className="text-2xl text-stone-400 font-serif italic">Add family photos in settings.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Wandering Alert Overlay */}
      <AnimatePresence>
        {isOutsideSafeZone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-rose-600 flex flex-col p-8 lg:p-16 text-white overflow-y-auto"
          >
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto py-12">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-48 h-48 bg-white/20 backdrop-blur-md rounded-[64px] flex items-center justify-center text-8xl mb-12 shadow-2xl"
              >
                <AlertTriangle className="w-24 h-24 text-white" />
              </motion.div>

              <h2 className="text-6xl lg:text-8xl font-serif font-bold mb-8 leading-tight">
                You are not in a familiar place
              </h2>

              <p className="text-3xl lg:text-4xl text-rose-100 mb-12 font-medium max-w-2xl">
                {isAlertActive
                  ? "Don't worry. Your family has been notified and they are coming to help you."
                  : "Don't worry. Your family is being updated on your location. Please stay calm."}
              </p>

              <div className="w-full max-w-4xl">
                <h3 className="text-2xl uppercase tracking-[0.2em] text-rose-200 mb-6 text-center font-bold">Call for Help</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
                  {contacts.map((contact) => (
                    <motion.button
                      key={contact.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => window.location.href = `tel:${contact.phone}`}
                      className="flex flex-col items-center gap-4 group"
                    >
                      <div className="w-32 h-32 rounded-[32px] overflow-hidden border-4 border-white/20 group-hover:border-white transition-all shadow-xl">
                        <img src={contact.photoUrl} alt={contact.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <span className="text-white text-xl font-bold">{contact.name}</span>
                    </motion.button>
                  ))}
                  {settings.caregiverEmail && !contacts.some(c => c.name.toLowerCase().includes('caregiver')) && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => window.location.href = `mailto:${settings.caregiverEmail}`}
                      className="flex flex-col items-center gap-4 group"
                    >
                      <div className="w-32 h-32 rounded-[32px] bg-white/10 flex items-center justify-center border-4 border-white/20 group-hover:border-white transition-all shadow-xl">
                        <UserPlus className="w-12 h-12 text-white" />
                      </div>
                      <span className="text-white text-xl font-bold">Caregiver</span>
                    </motion.button>
                  )}
                  {contacts.length === 0 && !settings.caregiverEmail && (
                    <button
                      onClick={() => {
                        // Fallback if no contacts
                        window.location.href = "tel:911";
                      }}
                      className="col-span-full bg-white/10 py-8 rounded-[32px] text-3xl font-bold flex items-center justify-center gap-4"
                    >
                      <Phone className="w-10 h-10" />
                      Call Emergency Services
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <button
                    onClick={() => {
                      playVoiceInstruction("Stay calm. A family member has been notified and is coming to get you. Please look for a safe place to sit down.");
                    }}
                    className="bg-rose-700 text-white py-10 rounded-[48px] text-5xl font-bold shadow-2xl border-4 border-rose-500 hover:bg-rose-800 transition-all active:scale-95 flex items-center justify-center gap-6"
                  >
                    <MapPin className="w-16 h-16" />
                    Go Home
                  </button>

                  <button
                    onClick={async () => {
                      playVoiceInstruction("I'm glad you are okay. Please be careful.");
                      await updateDoc(caregiverDoc(caregiverId, 'userStatus', 'current'), { isSafe: true });
                      await setDoc(
                        caregiverDoc(caregiverId, 'wanderingAlerts', 'active_wandering_alert'),
                        { status: 'resolved' },
                        { merge: true }
                      );
                    }}
                    className="bg-emerald-500 text-white py-10 rounded-[48px] text-5xl font-bold shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-6 active:scale-95"
                  >
                    <CheckCircle2 className="w-16 h-16" />
                    I am OK
                  </button>
                </div>
              </div>

              <div className="mt-16 p-8 bg-white/10 rounded-[40px] border border-white/20">
                <p className="text-3xl lg:text-4xl font-serif italic text-rose-100">
                  "Please stay where you are. We are on our way."
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step-by-Step Guidance Overlay */}
      <AnimatePresence>
        {activeMeeting && currentStepIndex !== -1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-stone-900 flex flex-col p-8 lg:p-16 overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-12">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-white/20">
                  <img src={activeMeeting.personPhotoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <h2 className="text-white text-4xl font-serif font-bold">Meeting with {activeMeeting.personName}</h2>
                  <p className="text-stone-400 text-2xl uppercase tracking-widest">Step {currentStepIndex + 1} of {activeMeeting.steps.length}</p>
                </div>
              </div>
              <button
                onClick={() => { setActiveMeeting(null); setCurrentStepIndex(-1); }}
                className="text-stone-400 hover:text-white text-2xl font-bold flex items-center gap-2"
              >
                Cancel
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
              <motion.div
                key={currentStepIndex}
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="w-full"
              >
                <div className="w-64 h-64 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center text-9xl mx-auto mb-12 border-8 border-rose-500/20">
                  {activeMeeting.steps[currentStepIndex]?.icon || '✨'}
                </div>
                <h3 className="text-7xl lg:text-8xl font-serif font-bold text-white leading-tight mb-12">
                  {activeMeeting.steps[currentStepIndex]?.text}
                </h3>
              </motion.div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 mt-12">
              <button
                onClick={() => playVoiceInstruction(activeMeeting.steps[currentStepIndex].text)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white py-8 rounded-[40px] text-4xl font-bold transition-all flex items-center justify-center gap-4"
              >
                <Volume2 className="w-12 h-12" />
                Listen Again
              </button>
              <button
                onClick={nextStep}
                className="flex-[2] bg-rose-500 hover:bg-rose-600 text-white py-8 rounded-[40px] text-5xl font-bold shadow-2xl transition-all flex items-center justify-center gap-4"
              >
                {currentStepIndex === activeMeeting.steps.length - 1 ? (
                  <>
                    <Check className="w-14 h-14" />
                    I'm Ready
                  </>
                ) : (
                  <>
                    Next Step
                    <ArrowRight className="w-14 h-14" />
                  </>
                )}
              </button>
            </div>

            {/* Emergency Contacts in Overlay */}
            <div className="mt-12 pt-12 border-t border-white/10">
              <h4 className="text-white/40 text-2xl uppercase tracking-widest text-center mb-8">Need Help? Call Someone</h4>
              <div className="flex justify-center gap-8">
                {contacts.slice(0, 3).map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => window.location.href = `tel:${contact.phone}`}
                    className="flex flex-col items-center gap-4 group"
                  >
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/20 group-hover:border-rose-500 transition-all">
                      <img src={contact.photoUrl} alt={contact.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <span className="text-white/60 text-xl font-bold group-hover:text-white">{contact.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reminder Overlay */}
      <AnimatePresence>
        {activeReminder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-stone-900/40 backdrop-blur-xl flex items-center justify-center p-8 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-[64px] shadow-2xl p-12 max-w-2xl w-full text-center border-8 border-amber-400"
            >
              <div className="w-48 h-48 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-8xl mx-auto mb-8 animate-bounce">
                {activeReminder.icon || '🔔'}
              </div>
              <h3 className="text-4xl font-bold text-amber-600 uppercase tracking-[0.2em] mb-4">Time For</h3>
              <h2 className="text-7xl font-serif font-bold text-stone-900 mb-12">{activeReminder.title}</h2>
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => handleCompleteTask(activeReminder.id)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-8 rounded-[32px] text-4xl font-bold shadow-xl transition-all"
                >
                  I'm doing it now
                </button>
                <button
                  onClick={() => setActiveReminder(null)}
                  className="w-full bg-stone-100 hover:bg-stone-200 text-stone-500 py-6 rounded-[32px] text-2xl font-bold transition-all"
                >
                  Remind me in 5 minutes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
