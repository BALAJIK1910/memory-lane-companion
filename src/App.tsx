import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { PatientInterface } from './components/PatientInterface';
import { CaregiverDashboard } from './components/CaregiverDashboard';
import { LocationTracker } from './components/LocationTracker';
import { LiveTrackingPage } from './components/LiveTrackingPage';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { auth, signIn, signOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { LogIn, LogOut, Settings as SettingsIcon, Heart } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setError(null);
    try {
      await signIn();
    } catch (err: any) {
      if (err.code === 'auth/cancelled-popup-request') {
        console.log('Sign-in popup was cancelled by a new request.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in window was closed. Please try again.');
      } else {
        setError('An error occurred during sign-in. Please try again.');
        console.error(err);
      }
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fdfbf7]">
        <div className="text-center">
          <Heart className="w-16 h-16 text-rose-400 animate-pulse mx-auto mb-4" />
          <p className="text-2xl font-serif italic text-stone-600">Memory Lane Companion...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fdfbf7] p-8">
        <div className="max-w-md w-full p-8 bg-white rounded-3xl shadow-xl border border-stone-100 text-center">
          <Heart className="w-12 h-12 text-rose-400 mx-auto mb-6" />
          <h1 className="text-4xl font-serif font-bold text-stone-800 mb-4">Welcome Home</h1>
          <p className="text-lg text-stone-600 mb-8">Please sign in to start your companion.</p>
          
          {error && (
            <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <button
            onClick={handleSignIn}
            disabled={signingIn}
            className={`w-full flex items-center justify-center gap-3 bg-stone-800 text-white py-4 px-6 rounded-2xl text-xl font-medium transition-all ${
              signingIn ? 'opacity-50 cursor-not-allowed' : 'hover:bg-stone-700'
            }`}
          >
            <LogIn className="w-6 h-6" />
            {signingIn ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-[#fdfbf7] text-stone-900">
        <Toaster position="top-right" richColors />
        <nav className="fixed top-4 right-4 z-[300] flex gap-3">
          <Link
            to="/caregiver"
            className="flex items-center gap-2 px-4 py-3 bg-stone-800 text-white rounded-full shadow-2xl border border-stone-700 hover:bg-stone-700 transition-all group"
            title="Caregiver Dashboard"
          >
            <SettingsIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
            <span className="font-bold text-sm uppercase tracking-widest pr-1">Caregiver</span>
          </Link>
          <button
            onClick={signOut}
            className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-xl border border-stone-200 text-stone-500 hover:text-rose-600 transition-all"
            title="Sign Out"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </nav>

        <LocationTracker />
        <Routes>
          <Route path="/" element={<PatientInterface />} />
          <Route path="/caregiver" element={<CaregiverDashboard />} />
          <Route path="/track/:patientId" element={<LiveTrackingPage />} />
        </Routes>
      </div>
    </Router>
  );
}
