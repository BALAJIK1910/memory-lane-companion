import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { PatientInterface } from './components/PatientInterface';
import { CaregiverDashboard } from './components/CaregiverDashboard';
import { LocationTracker } from './components/LocationTracker';
import { LiveTrackingPage } from './components/LiveTrackingPage';
import { Toaster } from 'sonner';
import { signOut } from './lib/firebase';
import { LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useUser } from './contexts/UserContext';

export default function App() {
  const { role } = useUser();

  return (
    <Router>
      <div className="min-h-screen bg-[#fdfbf7] text-stone-900">
        <Toaster position="top-right" richColors />
        <nav className="fixed top-4 right-4 z-[300] flex gap-3">
          {role === 'caregiver' && (
            <Link
              to="/caregiver"
              className="flex items-center gap-2 px-4 py-3 bg-stone-800 text-white rounded-full shadow-2xl border border-stone-700 hover:bg-stone-700 transition-all group"
              title="Caregiver Dashboard"
            >
              <SettingsIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
              <span className="font-bold text-sm uppercase tracking-widest pr-1">Caregiver</span>
            </Link>
          )}
          <button
            onClick={signOut}
            className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-xl border border-stone-200 text-stone-500 hover:text-rose-600 transition-all"
            title="Sign Out"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </nav>

        {role === 'patient' && <LocationTracker />}
        <Routes>
          <Route
            path="/"
            element={role === 'caregiver' ? <CaregiverDashboard /> : <PatientInterface />}
          />
          {role === 'caregiver' && (
            <Route path="/caregiver" element={<CaregiverDashboard />} />
          )}
          {role === 'caregiver' && (
            <Route path="/track/:patientId" element={<LiveTrackingPage />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}
