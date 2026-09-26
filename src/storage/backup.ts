// "Download My History" / "Restore My History".
// Internally a versioned JSON document; the UI never uses technical words.
import type { PoopEvent } from '../lib/stats';
import { dayKey } from '../lib/dates';
import type { MetaShape } from './db';
import { newId } from './db';

export const BACKUP_APP_ID = 'indras-bowel-operations-center';
export const BACKUP_FORMAT_VERSION = 2;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  formatVersion: number;
  savedAt: string;
  events: PoopEvent[];
  archive?: MetaShape['archive'];
  achievements?: MetaShape['achievements'];
  settings?: MetaShape['settings'];
}

export type ParseResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; reason: string };

export function backupFilename(now = new Date()): string {
  return `Indras-Poop-History-${dayKey(now)}.json`;
}

export function buildBackup(events: PoopEvent[], meta: Partial<MetaShape>, now = new Date()): BackupFile {
  return {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    savedAt: now.toISOString(),
    events: [...events].sort((a, b) => a.ts - b.ts),
    archive: meta.archive,
    achievements: meta.achievements,
    settings: meta.settings,
  };
}

export function serializeBackup(b: BackupFile): string {
  return JSON.stringify(b, null, 2);
}

const MIN_TS = Date.UTC(2000, 0, 1);

function validEvent(e: unknown, nowMs: number): e is PoopEvent {
  if (!e || typeof e !== 'object') return false;
  const x = e as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    x.id.length > 0 &&
    typeof x.ts === 'number' &&
    Number.isFinite(x.ts) &&
    x.ts >= MIN_TS &&
    x.ts <= nowMs + 86400000
  );
}

/** Upgrades older file layouts to the current one. v1 stored { events: [{ id, timestamp: ISO }] }. */
export function migrateBackup(raw: Record<string, unknown>): Record<string, unknown> {
  const v = typeof raw.formatVersion === 'number' ? raw.formatVersion : 1;
  if (v < 2 && Array.isArray(raw.events)) {
    return {
      ...raw,
      formatVersion: 2,
      events: (raw.events as Record<string, unknown>[]).map((e) => {
        const ts = typeof e.ts === 'number' ? e.ts : typeof e.timestamp === 'string' ? Date.parse(e.timestamp) : NaN;
        return {
          id: typeof e.id === 'string' ? e.id : newId(),
          ts,
          createdAt: typeof e.createdAt === 'number' ? e.createdAt : ts,
          source: 'restored',
        };
      }),
    };
  }
  return raw;
}

const NOT_OURS = "That file doesn't look like a Bowel Operations Center history. Please choose the file you saved with “Download My History”.";

export function parseBackup(text: string, nowMs = Date.now()): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: NOT_OURS };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: NOT_OURS };
  const obj = raw as Record<string, unknown>;
  if (obj.app !== BACKUP_APP_ID) return { ok: false, reason: NOT_OURS };
  if (typeof obj.formatVersion === 'number' && obj.formatVersion > BACKUP_FORMAT_VERSION) {
    return { ok: false, reason: 'This history was saved by a newer version of the app. Please reopen the app to update it, then try again.' };
  }
  const migrated = migrateBackup(obj);
  if (!Array.isArray(migrated.events)) return { ok: false, reason: NOT_OURS };
  const events = migrated.events as unknown[];
  const bad = events.filter((e) => !validEvent(e, nowMs)).length;
  if (bad > 0) {
    return { ok: false, reason: `Part of this file appears to be damaged (${bad} unreadable ${bad === 1 ? 'entry' : 'entries'}), so nothing was changed. Try another saved copy.` };
  }
  const clean: PoopEvent[] = (events as PoopEvent[]).map((e) => ({
    id: e.id,
    ts: e.ts,
    createdAt: typeof e.createdAt === 'number' && Number.isFinite(e.createdAt) ? e.createdAt : e.ts,
    source: e.source === 'tap' || e.source === 'manual' || e.source === 'restored' ? e.source : 'restored',
  }));
  return {
    ok: true,
    backup: {
      app: BACKUP_APP_ID,
      formatVersion: BACKUP_FORMAT_VERSION,
      savedAt: typeof migrated.savedAt === 'string' ? migrated.savedAt : new Date(nowMs).toISOString(),
      events: clean,
      archive: isRecord(migrated.archive) ? (migrated.archive as MetaShape['archive']) : undefined,
      achievements: isRecord(migrated.achievements) ? (migrated.achievements as MetaShape['achievements']) : undefined,
      settings: isRecord(migrated.settings) ? (migrated.settings as MetaShape['settings']) : undefined,
    },
  };
}

function isRecord(x: unknown): boolean {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

/** Saves a file to the device. Prefers the iPhone share sheet ("Save to Files"), falls back to a download. */
export async function saveFile(filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = new Blob([text], { type: 'application/json' });
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile && typeof File !== 'undefined' && navigator.canShare) {
    const file = new File([blob], filename, { type: 'application/json' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'My Poop History' });
        return 'shared';
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return 'cancelled';
        // fall through to a regular download
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

/** Reads a chosen file as text (FileReader fallback for older Safari). */
export function readFileText(f: Blob): Promise<string> {
  if (typeof (f as Blob & { text?: unknown }).text === 'function') return f.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsText(f);
  });
}
