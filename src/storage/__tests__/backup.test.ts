import { backupFilename, buildBackup, parseBackup, serializeBackup, BACKUP_APP_ID } from '../backup';
import { openStore } from '../db';
import { ev } from '../../test/fixtures';

const events = [ev('2026-09-01 08:00'), ev('2026-09-02 09:30'), ev('2026-09-02 18:00')];

describe('Download My History', () => {
  it('creates a friendly dated filename', () => {
    expect(backupFilename(new Date(2026, 8, 25))).toBe('Indras-Poop-History-2026-09-25.json');
  });
  it('serializes every event plus discoveries and awards', () => {
    const text = serializeBackup(buildBackup(events, { achievements: { 'launch-day': 1 }, archive: {} }));
    const parsed = JSON.parse(text);
    expect(parsed.app).toBe(BACKUP_APP_ID);
    expect(parsed.events).toHaveLength(3);
    expect(parsed.achievements).toEqual({ 'launch-day': 1 });
  });
});

describe('Restore My History', () => {
  it('round-trips a saved copy', () => {
    const r = parseBackup(serializeBackup(buildBackup(events, {})));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.events.map((e) => e.ts)).toEqual(events.map((e) => e.ts));
  });

  it.each([
    ['not JSON at all', 'hello there'],
    ['a JSON array', '[1,2,3]'],
    ['another app’s file', JSON.stringify({ app: 'something-else', events: [] })],
    ['missing events', JSON.stringify({ app: BACKUP_APP_ID, formatVersion: 2 })],
    ['a damaged event', JSON.stringify({ app: BACKUP_APP_ID, formatVersion: 2, events: [{ id: 'a', ts: 'yesterday' }] })],
    ['an impossible date', JSON.stringify({ app: BACKUP_APP_ID, formatVersion: 2, events: [{ id: 'a', ts: 5 }] })],
    ['a future version', JSON.stringify({ app: BACKUP_APP_ID, formatVersion: 99, events: [] })],
  ])('rejects malformed files: %s', (_label, text) => {
    const r = parseBackup(text);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).not.toMatch(/json|schema|database|import|export/i);
    }
  });

  it('upgrades older saved copies', () => {
    const r = parseBackup(JSON.stringify({ app: BACKUP_APP_ID, events: [{ id: 'old', timestamp: '2025-05-01T12:00:00Z' }] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.events[0]).toMatchObject({ id: 'old', ts: Date.parse('2025-05-01T12:00:00Z'), source: 'restored' });
  });

  it('adding a saved copy to existing history never duplicates events', async () => {
    const store = await openStore(`backup-${Math.random()}`);
    await store.mergeEvents(events.slice(0, 2));
    const r = parseBackup(serializeBackup(buildBackup(events, {})));
    if (!r.ok) throw new Error('should parse');
    expect(await store.mergeEvents(r.backup.events)).toBe(1);
    expect(await store.mergeEvents(r.backup.events)).toBe(0);
    expect(await store.getEvents()).toHaveLength(3);
  });
});
