import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  SessionUser,
  getCurrentSession,
  loginWithEmail,
  logout as apiLogout,
} from '../../lib/api';

interface AuthContextType {
  session: SessionUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  login: async () => { throw new Error('AuthContext not initialized'); },
  logout: async () => {},
  refreshSession: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getCurrentSession()
      .then((user) => {
        if (isMounted) {
          setSession(user);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error restoring session:', err);
        if (isMounted) {
          setSession(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshSession = async () => {
    try {
      const user = await getCurrentSession();
      setSession(user);
    } catch {
      setSession(null);
    }
  };

  const login = async (email: string, pass: string) => {
    const user = await loginWithEmail(email, pass);
    setSession(user);
    return user;
  };

  const logout = async () => {
    await apiLogout();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
