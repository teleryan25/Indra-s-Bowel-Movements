// Storage abstraction. IndexedDB is the authoritative store; a compact
// localStorage mirror of the event list is kept as a recovery copy in case
// the browser ever drops the IndexedDB database. Nothing ever leaves the device.
import type { PoopEvent } from '../lib/stats';

export const DB_NAME = 'indras-bowel-operations-center';
/** v1: events store. v2: meta store + ts index + source field backfill. */
export const DB_VERSION = 2;
const EVENTS = 'events';
const META = 'meta';
const MIRROR_KEY = 'ibo:mirror:v1';

/** A tap within this window of the previous tap is treated as an accidental double-tap. */
export const DOUBLE_TAP_MS = 4000;

export interface Settings {
  celebrations: boolean;
  /** 'system' follows the phone's setting */
  reducedMotion: 'system' | 'on' | 'off';
}
export const DEFAULT_SETTINGS: Settings = { celebrations: true, reducedMotion: 'system' };

export interface MetaShape {
  settings: Settings;
  archive: Record<string, { id: string; discoveredAt: number; lastSeenAt: number; text: string }>;
  achievements: Record<string, number>;
  /** day keys on which "No. Send help." was pressed; affects only that day's message */
  noDays: string[];
  installedAt: number;
}

export interface Store {
  getEvents(): Promise<PoopEvent[]>;
  addEvent(ts: number, source: PoopEvent['source']): Promise<{ event: PoopEvent; duplicate: boolean }>;
  deleteEvent(id: string): Promise<void>;
  getMeta<K extends keyof MetaShape>(key: K): Promise<MetaShape[K] | undefined>;
  setMeta<K extends keyof MetaShape>(key: K, value: MetaShape[K]): Promise<void>;
  /** Adds events that are not already present. Returns how many were added. */
  mergeEvents(events: PoopEvent[]): Promise<number>;
  replaceEvents(events: PoopEvent[]): Promise<void>;
  clearAll(): Promise<void>;
  close(): void;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Same event if same id, or timestamps within one second of each other. */
export function isDuplicate(a: PoopEvent, b: PoopEvent): boolean {
  return a.id === b.id || Math.abs(a.ts - b.ts) < 1000;
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

/** Schema migrations, applied in order from the stored version. */
export function migrate(db: IDBDatabase, tx: IDBTransaction, oldVersion: number): void {
  if (oldVersion < 1) {
    db.createObjectStore(EVENTS, { keyPath: 'id' });
  }
  if (oldVersion < 2) {
    const events = tx.objectStore(EVENTS);
    if (!events.indexNames.contains('ts')) events.createIndex('ts', 'ts');
    if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' });
    // v1 records had no `source`/`createdAt`; backfill them.
    const cursorReq = events.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      const v = cursor.value as Partial<PoopEvent> & { id: string; ts: number };
      if (!v.source || !v.createdAt) cursor.update({ ...v, source: v.source ?? 'tap', createdAt: v.createdAt ?? v.ts });
      cursor.continue();
    };
  }
}

function readMirror(): PoopEvent[] {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as [string, number, number, string][];
    return parsed.map(([id, ts, createdAt, source]) => ({ id, ts, createdAt, source: source as PoopEvent['source'] }));
  } catch {
    return [];
  }
}

function writeMirror(events: PoopEvent[]): void {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(events.map((e) => [e.id, e.ts, e.createdAt, e.source])));
  } catch {
    /* storage full or unavailable: IndexedDB remains authoritative */
  }
}

export async function openIdb(name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(name, DB_VERSION);
    r.onupgradeneeded = (e) => {
      migrate(r.result, r.transaction!, (e as IDBVersionChangeEvent).oldVersion);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Database upgrade blocked'));
  });
}

class IdbStore implements Store {
  constructor(private db: IDBDatabase) {}

  async getEvents(): Promise<PoopEvent[]> {
    const tx = this.db.transaction(EVENTS, 'readonly');
    const all = (await req(tx.objectStore(EVENTS).getAll())) as PoopEvent[];
    return all.sort((a, b) => a.ts - b.ts);
  }

  private async syncMirror() {
    writeMirror(await this.getEvents());
  }

  async addEvent(ts: number, source: PoopEvent['source']) {
    const existing = await this.getEvents();
    if (source === 'tap') {
      const recent = existing.filter((e) => Math.abs(e.ts - ts) < DOUBLE_TAP_MS).pop();
      if (recent) return { event: recent, duplicate: true };
    } else {
      const same = existing.find((e) => Math.abs(e.ts - ts) < 60_000);
      if (same) return { event: same, duplicate: true };
    }
    const event: PoopEvent = { id: newId(), ts, createdAt: Date.now(), source };
    const tx = this.db.transaction(EVENTS, 'readwrite');
    tx.objectStore(EVENTS).add(event);
    await done(tx);
    await this.syncMirror();
    return { event, duplicate: false };
  }

  async deleteEvent(id: string) {
    const tx = this.db.transaction(EVENTS, 'readwrite');
    tx.objectStore(EVENTS).delete(id);
    await done(tx);
    await this.syncMirror();
  }

  async getMeta<K extends keyof MetaShape>(key: K): Promise<MetaShape[K] | undefined> {
    const tx = this.db.transaction(META, 'readonly');
    const row = (await req(tx.objectStore(META).get(key))) as { key: K; value: MetaShape[K] } | undefined;
    return row?.value;
  }

  async setMeta<K extends keyof MetaShape>(key: K, value: MetaShape[K]) {
    const tx = this.db.transaction(META, 'readwrite');
    tx.objectStore(META).put({ key, value });
    await done(tx);
  }

  async mergeEvents(events: PoopEvent[]) {
    const existing = await this.getEvents();
    const toAdd: PoopEvent[] = [];
    for (const e of events) {
      if (existing.some((x) => isDuplicate(x, e)) || toAdd.some((x) => isDuplicate(x, e))) continue;
      toAdd.push(e);
    }
    if (toAdd.length) {
      const tx = this.db.transaction(EVENTS, 'readwrite');
      const store = tx.objectStore(EVENTS);
      for (const e of toAdd) store.put(e);
      await done(tx);
      await this.syncMirror();
    }
    return toAdd.length;
  }

  async replaceEvents(events: PoopEvent[]) {
    const tx = this.db.transaction(EVENTS, 'readwrite');
    const store = tx.objectStore(EVENTS);
    store.clear();
    const seen: PoopEvent[] = [];
    for (const e of events) {
      if (seen.some((x) => isDuplicate(x, e))) continue;
      seen.push(e);
      store.put(e);
    }
    await done(tx);
    await this.syncMirror();
  }

  async clearAll() {
    const tx = this.db.transaction([EVENTS, META], 'readwrite');
    tx.objectStore(EVENTS).clear();
    tx.objectStore(META).clear();
    await done(tx);
    try {
      localStorage.removeItem(MIRROR_KEY);
    } catch {
      /* ignore */
    }
  }

  close() {
    this.db.close();
  }
}

/** In-memory fallback (e.g. storage blocked). Keeps the app usable; mirror still attempted. */
export class MemoryStore implements Store {
  private events: PoopEvent[] = readMirror();
  private meta = new Map<string, unknown>();
  async getEvents() {
    return [...this.events].sort((a, b) => a.ts - b.ts);
  }
  async addEvent(ts: number, source: PoopEvent['source']) {
    const window = source === 'tap' ? DOUBLE_TAP_MS : 60_000;
    const dup = this.events.find((e) => Math.abs(e.ts - ts) < window);
    if (dup) return { event: dup, duplicate: true };
    const event: PoopEvent = { id: newId(), ts, createdAt: Date.now(), source };
    this.events.push(event);
    writeMirror(this.events);
    return { event, duplicate: false };
  }
  async deleteEvent(id: string) {
    this.events = this.events.filter((e) => e.id !== id);
    writeMirror(this.events);
  }
  async getMeta<K extends keyof MetaShape>(key: K) {
    return this.meta.get(key) as MetaShape[K] | undefined;
  }
  async setMeta<K extends keyof MetaShape>(key: K, value: MetaShape[K]) {
    this.meta.set(key, value);
  }
  async mergeEvents(events: PoopEvent[]) {
    let n = 0;
    for (const e of events) {
      if (this.events.some((x) => isDuplicate(x, e))) continue;
      this.events.push(e);
      n++;
    }
    writeMirror(this.events);
    return n;
  }
  async replaceEvents(events: PoopEvent[]) {
    this.events = [];
    await this.mergeEvents(events);
  }
  async clearAll() {
    this.events = [];
    this.meta.clear();
    try {
      localStorage.removeItem(MIRROR_KEY);
    } catch {
      /* ignore */
    }
  }
  close() {}
}

export async function openStore(name = DB_NAME): Promise<Store> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no indexedDB');
    const store = new IdbStore(await openIdb(name));
    // Recovery: if IndexedDB came back empty but the mirror has history, restore it.
    const events = await store.getEvents();
    if (events.length === 0) {
      const mirror = readMirror();
      if (mirror.length) await store.mergeEvents(mirror);
    }
    // Ask the browser to treat our storage as persistent (reduces eviction risk).
    try {
      await navigator.storage?.persist?.();
    } catch {
      /* ignore */
    }
    return store;
  } catch {
    return new MemoryStore();
  }
}
