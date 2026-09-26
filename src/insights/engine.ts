// Evaluates the 500-insight library against the analytics context, safely.
import type { Ctx } from '../lib/stats';
import { INSIGHTS } from './index';
import type { InsightDef, Rarity } from './types';

export interface InsightResult {
  def: InsightDef;
  text: string;
}

export interface ArchiveEntry {
  id: string;
  /** epoch ms when first discovered */
  discoveredAt: number;
  /** epoch ms when last seen eligible */
  lastSeenAt: number;
  /** the finding as it read most recently */
  text: string;
}

export type Archive = Record<string, ArchiveEntry>;

const BAD_TEXT = /\b(undefined|null|NaN|Infinity)\b|\[object Object\]/;

export function isCleanText(text: unknown): text is string {
  return typeof text === 'string' && text.trim().length > 0 && !BAD_TEXT.test(text);
}

/** Returns eligibility + message for one insight; never throws. */
export function evaluateOne(def: InsightDef, c: Ctx): InsightResult | null {
  if (c.n < def.minEvents) return null;
  if (def.minEvents > 0 && c.trackedDays < def.minDays) return null;
  try {
    if (!def.when(c)) return null;
    const text = def.msg(c);
    return isCleanText(text) ? { def, text } : null;
  } catch {
    return null;
  }
}

export function evaluateAll(c: Ctx, defs: InsightDef[] = INSIGHTS): InsightResult[] {
  const out: InsightResult[] = [];
  for (const d of defs) {
    const r = evaluateOne(d, c);
    if (r) out.push(r);
  }
  return out;
}

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 0, uncommon: 8, rare: 18, legendary: 30 };
export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Standard Intelligence',
  uncommon: 'Notable Finding',
  rare: 'Rare Discovery',
  legendary: 'Legendary Discovery',
};

/** Merges freshly eligible results into the archive. Returns the new archive and ids discovered this pass. */
export function updateArchive(archive: Archive, results: InsightResult[], nowMs: number): { archive: Archive; newIds: string[] } {
  const next: Archive = { ...archive };
  const newIds: string[] = [];
  for (const r of results) {
    const prev = next[r.def.id];
    if (!prev) {
      next[r.def.id] = { id: r.def.id, discoveredAt: nowMs, lastSeenAt: nowMs, text: r.text };
      newIds.push(r.def.id);
    } else {
      next[r.def.id] = { ...prev, lastSeenAt: nowMs, text: r.text };
    }
  }
  return { archive: next, newIds };
}

/**
 * Picks the day's briefing: a handful of relevant findings, favouring
 * fresh discoveries, rarity and priority, with daily rotation and category variety.
 */
export function selectBriefing(results: InsightResult[], archive: Archive, c: Ctx, nowMs: number, max = 5): InsightResult[] {
  const THREE_DAYS = 3 * 86400000;
  const scored = results.map((r) => {
    const a = archive[r.def.id];
    const fresh = !a || nowMs - a.discoveredAt < THREE_DAYS;
    const score =
      r.def.priority +
      RARITY_WEIGHT[r.def.rarity] +
      (fresh ? 25 : 0) +
      c.dailyRandom(r.def.id) * 30;
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked: InsightResult[] = [];
  const perCat = new Map<string, number>();
  for (const s of scored) {
    const n = perCat.get(s.r.def.category) ?? 0;
    if (n >= 1 && s.r.def.category !== 'milestone') continue;
    if (n >= 2) continue;
    picked.push(s.r);
    perCat.set(s.r.def.category, n + 1);
    if (picked.length >= max) break;
  }
  return picked;
}
