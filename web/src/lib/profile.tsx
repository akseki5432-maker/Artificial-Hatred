import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatMoney } from '@pocketpilot/core';
import { api } from './api.ts';
import type { Plan, Profile } from './types.ts';

interface ProfileState {
  profiles: Profile[];
  profile: Profile | null;
  plan: Plan | null;
  loading: boolean;
  error: string | null;
  selectProfile: (id: number | null) => void;
  refresh: () => Promise<void>;
  /** Money formatter bound to the active profile's currency. */
  money: (value: number, opts?: { compact?: boolean }) => string;
}

const Ctx = createContext<ProfileState | null>(null);
const STORAGE_KEY = 'pocketpilot.activeProfile';

function readStored(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<number | null>(readStored);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.profiles.list();
      setProfiles(list);
      const id = activeId !== null && list.some((p) => p.id === activeId) ? activeId : (list[0]?.id ?? null);
      if (id !== activeId) setActiveId(id);
      setPlan(id === null ? null : await api.profiles.plan(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    try {
      if (activeId === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, String(activeId));
    } catch {
      /* storage may be unavailable */
    }
  }, [activeId]);

  const profile = useMemo(() => profiles.find((p) => p.id === activeId) ?? null, [profiles, activeId]);
  const currency = profile?.currency ?? 'USD';
  const money = useCallback((value: number, opts?: { compact?: boolean }) => formatMoney(value, { currency, compact: opts?.compact }), [currency]);

  const value = useMemo<ProfileState>(
    () => ({ profiles, profile, plan, loading, error, selectProfile: setActiveId, refresh, money }),
    [profiles, profile, plan, loading, error, refresh, money],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile(): ProfileState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}
