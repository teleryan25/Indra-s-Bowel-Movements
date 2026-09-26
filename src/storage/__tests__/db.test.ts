import { openStore, DB_VERSION, DOUBLE_TAP_MS } from '../db';

let n = 0;
const name = () => `test-db-${++n}-${Math.random()}`;

describe('on-device storage', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', async () => {
    const s = await openStore(name());
    expect(await s.getEvents()).toEqual([]);
  });

  it('records, persists across re-open, and deletes', async () => {
    const db = name();
    const s = await openStore(db);
    const { event } = await s.addEvent(Date.now() - 5000, 'tap');
    await s.addEvent(Date.now() - 60 * 60000, 'manual');
    s.close();
    const again = await openStore(db);
    const events = await again.getEvents();
    expect(events).toHaveLength(2);
    expect(events[0].ts).toBeLessThan(events[1].ts);
    await again.deleteEvent(event.id);
    expect((await again.getEvents()).map((e) => e.id)).not.toContain(event.id);
  });

  it('protects against accidental double taps', async () => {
    const s = await openStore(name());
    const t = Date.now();
    const a = await s.addEvent(t, 'tap');
    const b = await s.addEvent(t + DOUBLE_TAP_MS - 500, 'tap');
    expect(b.duplicate).toBe(true);
    expect(b.event.id).toBe(a.event.id);
    const c = await s.addEvent(t + DOUBLE_TAP_MS + 1000, 'tap');
    expect(c.duplicate).toBe(false);
    expect(await s.getEvents()).toHaveLength(2);
  });

  it('merges without duplicating and replaces cleanly', async () => {
    const s = await openStore(name());
    const { event } = await s.addEvent(1_750_000_000_000, 'tap');
    const added = await s.mergeEvents([
      event,
      { ...event, id: 'other-id' }, // same moment, different id → still a duplicate
      { id: 'new-1', ts: 1_750_100_000_000, createdAt: 1, source: 'restored' },
      { id: 'new-1', ts: 1_750_100_000_000, createdAt: 1, source: 'restored' },
    ]);
    expect(added).toBe(1);
    expect(await s.getEvents()).toHaveLength(2);
    await s.replaceEvents([{ id: 'x', ts: 1_760_000_000_000, createdAt: 1, source: 'restored' }]);
    expect((await s.getEvents()).map((e) => e.id)).toEqual(['x']);
  });

  it('stores settings and other metadata', async () => {
    const db = name();
    const s = await openStore(db);
    await s.setMeta('settings', { celebrations: false, reducedMotion: 'on' });
    s.close();
    const again = await openStore(db);
    expect(await again.getMeta('settings')).toEqual({ celebrations: false, reducedMotion: 'on' });
  });

  it('clears everything on request', async () => {
    const s = await openStore(name());
    await s.addEvent(Date.now(), 'tap');
    await s.setMeta('noDays', ['2026-01-01']);
    await s.clearAll();
    expect(await s.getEvents()).toEqual([]);
    expect(await s.getMeta('noDays')).toBeUndefined();
  });

  it('migrates a version-1 database to the current schema', async () => {
    const db = name();
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open(db, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('events', { keyPath: 'id' });
      r.onsuccess = () => {
        const tx = r.result.transaction('events', 'readwrite');
        tx.objectStore('events').put({ id: 'legacy-1', ts: 1_700_000_000_000 });
        tx.oncomplete = () => { r.result.close(); resolve(); };
      };
      r.onerror = () => reject(r.error);
    });
    const s = await openStore(db);
    const events = await s.getEvents();
    expect(events).toEqual([{ id: 'legacy-1', ts: 1_700_000_000_000, createdAt: 1_700_000_000_000, source: 'tap' }]);
    await s.setMeta('installedAt', 1); // meta store exists after migration
    const version = await new Promise<number>((res) => { const r = indexedDB.open(db); r.onsuccess = () => { res(r.result.version); r.result.close(); }; });
    expect(version).toBe(DB_VERSION);
  });

  it('recovers history from the on-device mirror if the database is lost', async () => {
    const first = await openStore(name());
    await first.addEvent(1_750_000_000_000, 'tap');
    // simulate the browser dropping IndexedDB: brand-new empty database, same device
    const fresh = await openStore(name());
    expect((await fresh.getEvents()).map((e) => e.ts)).toEqual([1_750_000_000_000]);
  });
});
