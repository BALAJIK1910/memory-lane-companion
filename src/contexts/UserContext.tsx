import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Heart } from 'lucide-react';
import { auth, resolveUserRole, signOut } from '../lib/firebase';
import { LoginPage } from '../components/LoginPage.tsx';

export interface UserContextType {
    uid: string;
    role: 'caregiver' | 'patient';
    caregiverId: string;
}

export const UserContext = createContext<UserContextType | null>(null);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function resolveUserRoleWithRetry(uid: string, attempts = 5) {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            return await resolveUserRole(uid);
        } catch (error) {
            lastError = error;
            await sleep(250);
        }
    }
    throw lastError;
}

export function UserProvider({ children }: { children: ReactNode }) {
    const [ctx, setCtx] = useState<UserContextType | null>(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setLoading(true);
            if (!user) {
                setCtx(null);
                setLoading(false);
                return;
            }

            try {
                const { role, caregiverId } = await resolveUserRoleWithRetry(user.uid);
                setCtx({ uid: user.uid, role, caregiverId });
                setAuthError(null);
            } catch (error) {
                console.error('Failed to resolve user role:', error);
                setAuthError('Your account profile could not be found. Please sign in again or register.');
                setCtx(null);
                await signOut();
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

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

    return (
        <UserContext.Provider value={ctx}>
            {ctx ? children : <LoginPage initialError={authError} />}
        </UserContext.Provider>
    );
}

export function useUser() {
    const ctx = useContext(UserContext);
    if (!ctx) {
        throw new Error('useUser must be inside UserProvider');
    }
    return ctx;
}
