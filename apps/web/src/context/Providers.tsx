import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

export interface User {
  id: string; name: string | null; email: string | null; phone: string | null; bkash: string | null;
  overseas: boolean; verified: boolean; prizeEligible: boolean; verificationCode: string | null; role: 'user' | 'admin';
}

interface AuthCtx { user: User | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void>; }
const Ctx = createContext<AuthCtx>({ user: null, loading: true, refresh: async () => {}, logout: async () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try { const r = await api.get('/api/me'); setUser(r.user); }
    catch { setUser(null); }
    finally { setLoading(false); }
  }
  async function logout() { setUser(null); try { await api.post('/auth/logout'); } catch {} }

  useEffect(() => { refresh(); }, []);
  return <Ctx.Provider value={{ user, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

// ---- Theme ----
interface ThemeCtx { dark: boolean; toggle: () => void; }
const ThemeContext = createContext<ThemeCtx>({ dark: true, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('bb-theme');
    const isDark = saved ? saved === 'dark' : false;
    setDark(isDark);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('bb-theme', dark ? 'dark' : 'light');
  }, [dark]);
  return <ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>{children}</ThemeContext.Provider>;
}
