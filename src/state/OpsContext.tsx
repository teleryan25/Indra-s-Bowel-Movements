import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildCtx, type Ctx, type PoopEvent } from '../lib/stats';
import { dayKey, parseKey } from '../lib/dates';
import { ACHIEVEMENTS, unlockedIds, type AchievementDef } from '../lib/achievements';
import { evaluateAll, updateArchive, type Archive, type InsightResult } from '../insights/engine';
import { DEFAULT_SETTINGS, openStore, type MetaShape, type Settings, type Store } from '../storage/db';
import type { BackupFile } from '../storage/backup';
import { pickCelebration } from '../lib/copy';

export interface Celebration {
  key: number;
  headline: string;
  count: number;
  achievements: AchievementDef[];
}

interface OpsValue {
  ready: boolean;
  events: PoopEvent[];
  ctx: Ctx;
  settings: Settings;
  archive: Archive;
  achievements: Record<string, number>;
  results: InsightResult[];
  newInsightIds: string[];
  saidNoToday: boolean;
  reducedMotion: boolean;
  celebration: Celebration | null;
  dismissCelebration: () => void;
  recordPoop: () => Promise<void>;
  recordNo: () => Promise<void>;
  addPastEvent: (key: string, minutes: number) => Promise<boolean>;
  deleteEvent: (id: string) => Promise<void>;
  updateSettings: (s: Partial<Settings>) => Promise<void>;
  restore: (b: BackupFile, mode: 'add' | 'replace') => Promise<number>;
  deleteEverything: () => Promise<void>;
  getMetaSnapshot: () => Partial<MetaShape>;
}

const OpsContext = createContext<OpsValue | null>(null);

export function useOps(): OpsValue {
  const v = useContext(OpsContext);
  if (!v) throw new Error('useOps outside provider');
  return v;
}

function usePrefersReducedMotion() {
  const [v, setV] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setV(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return v;
}

export function OpsProvider({ children, storeFactory = openStore, clock = () => new Date() }: { children: ReactNode; storeFactory?: () => Promise<Store>; clock?: () => Date }) {
  const storeRef = useRef<Store | null>(null);
  const [ready, setReady] = useState(false);
  const [events, setEvents] = useState<PoopEvent[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [archive, setArchive] = useState<Archive>({});
  const [achievements, setAchievements] = useState<Record<string, number>>({});
  const [noDays, setNoDays] = useState<string[]>([]);
  const [now, setNow] = useState<Date>(() => clock());
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [newInsightIds, setNewInsightIds] = useState<string[]>([]);
  const systemReduced = usePrefersReducedMotion();
  const pendingCelebration = useRef<{ headline: string } | null>(null);
  const archiveRef = useRef<Archive>({});
  const achRef = useRef<Record<string, number>>({});

  // Load everything once.
  useEffect(() => {
    let alive = true;
    (async () => {
      const store = await storeFactory();
      storeRef.current = store;
      const [evs, s, a, ach, nd, installed] = await Promise.all([
        store.getEvents(),
        store.getMeta('settings'),
        store.getMeta('archive'),
        store.getMeta('achievements'),
        store.getMeta('noDays'),
        store.getMeta('installedAt'),
      ]);
      if (!installed) await store.setMeta('installedAt', Date.now());
      if (!alive) return;
      archiveRef.current = a ?? {};
      achRef.current = ach ?? {};
      setEvents(evs);
      setSettings({ ...DEFAULT_SETTINGS, ...(s ?? {}) });
      setArchive(a ?? {});
      setAchievements(ach ?? {});
      setNoDays(nd ?? []);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [storeFactory]);

  // Keep "today" accurate while the app stays open (midnight rollover, returning from background).
  useEffect(() => {
    const tick = () => setNow(clock());
    const id = setInterval(tick, 60_000);
    const vis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('focus', tick);
    };
  }, [clock]);

  const ctx = useMemo(() => buildCtx(events, now), [events, now]);
  const results = useMemo(() => (ready ? evaluateAll(ctx) : []), [ctx, ready]);

  // Discover insights and unlock achievements whenever the data changes.
  useEffect(() => {
    if (!ready || !storeRef.current) return;
    const store = storeRef.current;
    const nowMs = now.getTime();
    const { archive: nextArchive, newIds } = updateArchive(archiveRef.current, results, nowMs);
    archiveRef.current = nextArchive;
    setArchive(nextArchive);
    if (newIds.length) setNewInsightIds((prev) => [...new Set([...prev, ...newIds])]);
    void store.setMeta('archive', nextArchive);

    const unlocked = unlockedIds(ctx);
    const fresh = unlocked.filter((id) => !achRef.current[id]);
    if (fresh.length) {
      const next = { ...achRef.current };
      for (const id of fresh) next[id] = nowMs;
      achRef.current = next;
      setAchievements(next);
      void store.setMeta('achievements', next);
    }
    if (pendingCelebration.current) {
      const { headline } = pendingCelebration.current;
      pendingCelebration.current = null;
      setCelebration({
        key: nowMs,
        headline,
        count: ctx.todayCount,
        achievements: ACHIEVEMENTS.filter((a) => fresh.includes(a.id)),
      });
    }
  }, [results, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(async () => {
    const store = storeRef.current!;
    const evs = await store.getEvents();
    setNow(clock());
    setEvents(evs);
  }, [clock]);

  const recordPoop = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const t = clock();
    const { duplicate } = await store.addEvent(t.getTime(), 'tap');
    if (duplicate) return;
    pendingCelebration.current = { headline: pickCelebration() };
    await reload();
  }, [clock, reload]);

  const recordNo = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const key = dayKey(clock());
    const next = [...new Set([...noDays, key])].slice(-60);
    setNoDays(next);
    await store.setMeta('noDays', next);
  }, [clock, noDays]);

  const addPastEvent = useCallback(async (key: string, minutes: number) => {
    const store = storeRef.current;
    if (!store) return false;
    const { y, m, d } = parseKey(key);
    const ts = new Date(y, m, d, Math.floor(minutes / 60), minutes % 60).getTime();
    if (ts > Date.now() + 60_000) return false;
    const { duplicate } = await store.addEvent(ts, 'manual');
    await reload();
    return !duplicate;
  }, [reload]);

  const deleteEvent = useCallback(async (id: string) => {
    await storeRef.current?.deleteEvent(id);
    await reload();
  }, [reload]);

  const updateSettings = useCallback(async (s: Partial<Settings>) => {
    const next = { ...settings, ...s };
    setSettings(next);
    await storeRef.current?.setMeta('settings', next);
  }, [settings]);

  const restore = useCallback(async (b: BackupFile, mode: 'add' | 'replace') => {
    const store = storeRef.current!;
    let added: number;
    if (mode === 'replace') {
      await store.replaceEvents(b.events);
      added = b.events.length;
      const a = b.archive ?? {};
      const ach = b.achievements ?? {};
      archiveRef.current = a;
      achRef.current = ach;
      setArchive(a);
      setAchievements(ach);
      await store.setMeta('archive', a);
      await store.setMeta('achievements', ach);
    } else {
      added = await store.mergeEvents(b.events);
      const a = { ...(b.archive ?? {}), ...archiveRef.current };
      const ach = { ...(b.achievements ?? {}), ...achRef.current };
      archiveRef.current = a;
      achRef.current = ach;
      setArchive(a);
      setAchievements(ach);
      await store.setMeta('archive', a);
      await store.setMeta('achievements', ach);
    }
    await reload();
    return added;
  }, [reload]);

  const deleteEverything = useCallback(async () => {
    const store = storeRef.current!;
    await store.clearAll();
    archiveRef.current = {};
    achRef.current = {};
    setArchive({});
    setAchievements({});
    setNoDays([]);
    setNewInsightIds([]);
    setSettings(DEFAULT_SETTINGS);
    await store.setMeta('installedAt', Date.now());
    await reload();
  }, [reload]);

  const reducedMotion = settings.reducedMotion === 'on' || (settings.reducedMotion === 'system' && systemReduced);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion);
  }, [reducedMotion]);

  const value: OpsValue = {
    ready,
    events,
    ctx,
    settings,
    archive,
    achievements,
    results,
    newInsightIds,
    saidNoToday: noDays.includes(ctx.todayKey),
    reducedMotion,
    celebration,
    dismissCelebration: () => setCelebration(null),
    recordPoop,
    recordNo,
    addPastEvent,
    deleteEvent,
    updateSettings,
    restore,
    deleteEverything,
    getMetaSnapshot: () => ({ archive: archiveRef.current, achievements: achRef.current, settings }),
  };

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}
