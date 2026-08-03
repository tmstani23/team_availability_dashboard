import { useState, useEffect, type ReactNode } from 'react';
import { API_BASE } from '../config';
// Context object + useAuth live in their own module so this file exports only
// a component, which is what Fast Refresh needs to hot-reload it.
import { AuthContext } from './useAuth';

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
                const res = await fetch(`${API_BASE}/api/auth/me`, {
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
            const res = await fetch(`${API_BASE}/api/auth/login`, {
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
        } catch {
            return { success: false, message: 'Network error - please try again' };
        }
    };

    const logout = async () => {
        try {
            await fetch(`${API_BASE}/api/auth/logout`, {
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
        <AuthContext.Provider value={{ role, teamMemberId, isAuthenticated: !!role, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
