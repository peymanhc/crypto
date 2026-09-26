// Login, sessions and the admin's user management, all served by the Worker.
import axios from 'axios';
import { workerUrl, workerHeaders, getAppKey, setAppKey } from './api';

export type Role = 'admin' | 'user';

export interface Session {
  token: string;
  username: string;
  expiresAt: number;
}

export interface ManagedUser {
  username: string;
  createdAt: number;
  expiresAt: number | null;
  disabled: boolean;
  lastLoginAt: number | null;
  hlAddresses: { address: string; network: 'mainnet' | 'testnet'; addedAt: number }[];
}

const SESSION_STORAGE = 'session';

export const loadSession = (): Session | null => {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_STORAGE) ?? 'null');
    return s && typeof s.token === 'string' ? s : null;
  } catch {
    return null;
  }
};

export const saveSession = (session: Session | null) => {
  try {
    if (session) localStorage.setItem(SESSION_STORAGE, JSON.stringify(session));
    else localStorage.removeItem(SESSION_STORAGE);
  } catch {
    // storage unavailable
  }
};

const call = async <T>(method: 'get' | 'post', path: string, data?: unknown, headers?: Record<string, string>): Promise<T> => {
  const response = await axios.request({ method, url: workerUrl(path), data, headers: headers ?? workerHeaders(), validateStatus: () => true });
  if (!response.data?.ok) throw new Error(response.data?.error ?? `HTTP ${response.status}`);
  return response.data as T;
};

// Username + password -> session token
export const loginUser = async (username: string, password: string): Promise<Session> => {
  const data = await call<{ token: string; username: string; expiresAt: number }>('post', '/auth/login', { username, password }, {});
  const session = { token: data.token, username: data.username, expiresAt: data.expiresAt };
  saveSession(session);
  setAppKey('');
  return session;
};

// Admin key -> checked against the Worker once, then kept in this browser
export const loginAdmin = async (key: string): Promise<void> => {
  const trimmed = key.trim();
  await call('get', '/auth/me', undefined, { 'x-app-key': trimmed });
  setAppKey(trimmed);
  saveSession(null);
};

// Validates whatever is stored; resolves to null when nothing valid is there
export const whoAmI = async (): Promise<{ role: Role; username: string; expiresAt?: number } | null> => {
  if (!getAppKey() && !loadSession()) return null;
  try {
    return await call('get', '/auth/me');
  } catch {
    return null;
  }
};

export const logout = async (): Promise<void> => {
  if (loadSession()) await call('post', '/auth/logout').catch(() => {});
  saveSession(null);
  setAppKey('');
};

// Tells the Worker which Hyperliquid account this login trades with (for the admin PnL view)
export const reportHlAddress = (address: string, network: 'mainnet' | 'testnet') =>
  call('post', '/auth/hl-address', { address, network }).catch(() => {});

// ---- admin ----
export const adminListUsers = async (): Promise<ManagedUser[]> => (await call<{ users: ManagedUser[] }>('get', '/admin/users')).users;

export const adminCreateUser = (username: string, password: string, expiresAt: number) =>
  call<{ user: ManagedUser }>('post', '/admin/users', { username, password, expiresAt });

export const adminUpdateUser = async (username: string, action: 'disable' | 'enable' | 'delete' | 'extend', expiresAt?: number): Promise<ManagedUser[]> =>
  (await call<{ users: ManagedUser[] }>('post', '/admin/users/update', { username, action, expiresAt })).users;
