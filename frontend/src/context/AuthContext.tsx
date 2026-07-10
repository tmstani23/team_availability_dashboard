import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [role, setRole] = useState<'admin' | 'member' | null>(null);
    const [teamMemberId, setTeamMemberId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // On mount, ask the backend if a valid session cookie already exists.
    // This is how login state survives a page refresh - we can't read the
    // httpOnly cookie ourselves, so we have to ask the server to check it.
    useEffect(() => {
        const checkSession = async () => {
            try {
                const res = await fetch('http://localhost:5000/api/auth/me', {
                    credentials: 'include' // required to send the httpOnly cookie cross-origin
                });

                if (res.ok) {
                    const data = await res.json();
                    setRole(data.role);
                    setTeamMemberId(data.teamMemberId);
                }
                // A non-ok response just means "not logged in" - leave state as null,
                // this isn't an error case worth logging
            } catch (err) {
                console.error('Failed to check session:', err);
            } finally {
                setLoading(false);
            }
        };

        checkSession();
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const res = await fetch('http://localhost:5000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // lets the browser store the httpOnly cookie the response sets
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                return { success: false, message: data.message || 'Login failed' };
            }

            setRole(data.role);
            setTeamMemberId(data.teamMemberId);
            return { success: true };
        } catch (err) {
            return { success: false, message: 'Network error - please try again' };
        }
    };

    const logout = async () => {
        try {
            await fetch('http://localhost:5000/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (err) {
            console.error('Failed to log out:', err);
        } finally {
            // Clear local state regardless of network success - the cookie expires
            // on its own even if this specific request fails
            setRole(null);
            setTeamMemberId(null);
        }
    };

    return (
        <AuthContext.Provider value= {{ role, teamMemberId, isAuthenticated: !!role, loading, login, logout }
}>
    { children }
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};