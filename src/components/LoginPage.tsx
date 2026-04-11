import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Heart, LogIn, UserPlus } from 'lucide-react';
import { registerCaregiver, registerPatient, signInWithEmail } from '../lib/firebase';

type Role = 'caregiver' | 'patient';
type Mode = 'signin' | 'register';

interface LoginPageProps {
    initialError?: string | null;
}

export function LoginPage({ initialError }: LoginPageProps) {
    const [role, setRole] = useState<Role>('caregiver');
    const [mode, setMode] = useState<Mode>('signin');
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        inviteCode: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(initialError ?? null);
    const [inviteCode, setInviteCode] = useState<string | null>(null);

    useEffect(() => {
        setError(initialError ?? null);
    }, [initialError]);

    const resetFeedback = () => {
        setError(null);
        setInviteCode(null);
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (loading) return;

        setLoading(true);
        resetFeedback();

        try {
            if (mode === 'signin') {
                await signInWithEmail(form.email, form.password);
            } else if (role === 'caregiver') {
                const result = await registerCaregiver(form.email, form.password, form.name);
                setInviteCode(result.inviteCode);
            } else {
                await registerPatient(form.email, form.password, form.name, form.inviteCode);
            }
        } catch (err: any) {
            const code = err?.code as string | undefined;
            if (code === 'auth/email-already-in-use') {
                setError('This email is already in use. Try signing in instead.');
            } else if (code === 'auth/invalid-email') {
                setError('Please enter a valid email address.');
            } else if (code === 'auth/weak-password') {
                setError('Password must be at least 6 characters.');
            } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
                setError('Incorrect email or password.');
            } else {
                setError(err?.message || 'Something went wrong. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const updateForm = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
        setForm(prev => ({ ...prev, [field]: event.target.value }));
    };

    const isRegister = mode === 'register';
    const isCaregiver = role === 'caregiver';

    return (
        <div className="flex items-center justify-center min-h-screen bg-[#fdfbf7] p-8">
            <div className="max-w-lg w-full p-8 bg-white rounded-3xl shadow-xl border border-stone-100">
                <div className="text-center mb-8">
                    <Heart className="w-12 h-12 text-rose-400 mx-auto mb-4" />
                    <h1 className="text-4xl font-serif font-bold text-stone-800 mb-2">Welcome Back</h1>
                    <p className="text-stone-600">Sign in or create your Memory Lane Companion account.</p>
                </div>

                <div className="flex gap-3 mb-6">
                    <button
                        type="button"
                        onClick={() => {
                            setRole('caregiver');
                            resetFeedback();
                        }}
                        className={`flex-1 py-3 rounded-2xl font-bold border transition-all ${isCaregiver
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                            }`}
                    >
                        Caregiver
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setRole('patient');
                            resetFeedback();
                        }}
                        className={`flex-1 py-3 rounded-2xl font-bold border transition-all ${!isCaregiver
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                            }`}
                    >
                        Patient
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                        type="button"
                        onClick={() => {
                            setMode('signin');
                            resetFeedback();
                        }}
                        className={`py-2 rounded-xl font-semibold border transition-all ${mode === 'signin'
                            ? 'bg-rose-500 text-white border-rose-500'
                            : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                            }`}
                    >
                        Sign In
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setMode('register');
                            resetFeedback();
                        }}
                        className={`py-2 rounded-xl font-semibold border transition-all ${mode === 'register'
                            ? 'bg-rose-500 text-white border-rose-500'
                            : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                            }`}
                    >
                        Register
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium">
                        {error}
                    </div>
                )}

                {inviteCode && (
                    <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-semibold">
                        <p className="uppercase tracking-widest text-[11px] text-emerald-500 mb-2">Caregiver Invite Code</p>
                        <p className="text-2xl font-bold tracking-[0.3em]">{inviteCode}</p>
                        <p className="text-xs text-emerald-600 mt-2">Share this code with the patient to link accounts.</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isRegister && (
                        <input
                            type="text"
                            placeholder="Full name"
                            value={form.name}
                            onChange={updateForm('name')}
                            className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none"
                            required
                        />
                    )}

                    <input
                        type="email"
                        placeholder="Email address"
                        value={form.email}
                        onChange={updateForm('email')}
                        className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none"
                        required
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        value={form.password}
                        onChange={updateForm('password')}
                        className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none"
                        required
                    />

                    {isRegister && !isCaregiver && (
                        <input
                            type="text"
                            placeholder="6-digit invite code"
                            value={form.inviteCode}
                            onChange={updateForm('inviteCode')}
                            className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none"
                            required
                        />
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full flex items-center justify-center gap-3 py-3 px-6 rounded-2xl text-lg font-semibold transition-all ${loading
                            ? 'bg-stone-300 text-white cursor-not-allowed'
                            : 'bg-stone-900 text-white hover:bg-stone-800'
                            }`}
                    >
                        {mode === 'signin' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                        {loading ? 'Working...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>
    );
}
