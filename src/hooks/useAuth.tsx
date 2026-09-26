import { createContext, useContext, useEffect, useState } from 'react';
import { Role, loadSession, loginAdmin, loginUser, logout as endSession, whoAmI } from '../services/auth';

export interface AuthState {
  // undefined while the stored login is being checked
  ready: boolean;
  role: Role | null;
  username: string;
  expiresAt: number | null;
  loginUser: (username: string, password: string) => Promise<void>;
  loginAdmin: (key: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Checks the stored admin key / session with the Worker once, then exposes who is logged in
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [username, setUsername] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const apply = (me: { role: Role; username: string; expiresAt?: number } | null) => {
    setRole(me?.role ?? null);
    setUsername(me?.username ?? '');
    setExpiresAt(me?.expiresAt ?? loadSession()?.expiresAt ?? null);
  };

  useEffect(() => {
    whoAmI().then(apply).finally(() => setReady(true));
  }, []);

  const value: AuthState = {
    ready,
    role,
    username,
    expiresAt,
    loginUser: async (u, p) => {
      const session = await loginUser(u, p);
      apply({ role: 'user', username: session.username, expiresAt: session.expiresAt });
    },
    loginAdmin: async (key) => {
      await loginAdmin(key);
      apply({ role: 'admin', username: 'admin' });
    },
    logout: async () => {
      await endSession();
      apply(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
