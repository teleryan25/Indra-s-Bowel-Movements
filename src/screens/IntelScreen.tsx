import { useMemo, useState } from 'react';
import { useOps } from '../state/OpsContext';
import { INSIGHTS } from '../insights';
import { CATEGORY_LABEL, type Category, type InsightDef } from '../insights/types';
import { selectBriefing, RARITY_LABEL } from '../insights/engine';
import { InsightCard } from '../components/InsightCard';
import { IconArchive, IconChevronLeft, IconChevronRight, IconLock } from '../components/Icons';
import { fmtDayShort, dayKey } from '../lib/dates';

const BY_ID = new Map(INSIGHTS.map((d) => [d.id, d]));
const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

function discoveredLabel(ms: number, todayKey: string) {
  const k = dayKey(new Date(ms));
  return k === todayKey ? 'Discovered today' : `Discovered ${fmtDayShort(k)}`;
}

export function IntelScreen() {
  const [view, setView] = useState<'briefing' | 'archive'>('briefing');
  return view === 'briefing' ? <Briefing openArchive={() => setView('archive')} /> : <ArchiveView back={() => setView('briefing')} />;
}

function Briefing({ openArchive }: { openArchive: () => void }) {
  const { results, archive, ctx, newInsightIds } = useOps();
  const nowMs = ctx.now.getTime();
  const briefing = useMemo(() => selectBriefing(results, archive, ctx, nowMs, 5), [results, archive, ctx, nowMs]);
  const discovered = Object.keys(archive).length;
  const briefIds = new Set(briefing.map((b) => b.def.id));
  const recent = Object.values(archive)
    .filter((a) => !briefIds.has(a.id) && BY_ID.has(a.id))
    .sort((a, b) => b.discoveredAt - a.discoveredAt)
    .slice(0, 4);

  return (
    <>
      <h1 className="sr-only">Bowel Intelligence Division</h1>
      <section className="intel-head">
        <svg className="radar" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="48" fill="none" stroke="#fff" strokeWidth="1" />
          <circle cx="50" cy="50" r="32" fill="none" stroke="#fff" strokeWidth="1" />
          <circle cx="50" cy="50" r="16" fill="none" stroke="#fff" strokeWidth="1" />
          <path d="M50 50 L95 30" stroke="#fff" strokeWidth="2" />
        </svg>
        <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.62)' }}>Classified · Eyes only</div>
        <h1 aria-hidden="true">Bowel Intelligence Division</h1>
        <p>Turning movements into actionable intelligence.</p>
        <div className="intel-stat">
          <span>Findings discovered</span>
          <span><b>{discovered}</b> of {INSIGHTS.length}</span>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={INSIGHTS.length} aria-valuenow={discovered} aria-label="Findings discovered">
          <span style={{ width: `${Math.max(1.5, (discovered / INSIGHTS.length) * 100)}%` }} />
        </div>
      </section>

      <div className="section-title">
        <h2>Today's Briefing</h2>
        <span className="aside">{briefing.length} finding{briefing.length === 1 ? '' : 's'}</span>
      </div>
      <div className="card-list">
        {briefing.map((b) => (
          <InsightCard key={b.def.id} def={b.def} text={b.text} isNew={newInsightIds.includes(b.def.id)} />
        ))}
      </div>

      {recent.length > 0 && (
        <>
          <div className="section-title"><h2>Recent Discoveries</h2></div>
          <div className="card-list">
            {recent.map((a) => (
              <InsightCard key={a.id} def={BY_ID.get(a.id)!} text={a.text} isNew={newInsightIds.includes(a.id)} when={discoveredLabel(a.discoveredAt, ctx.todayKey)} />
            ))}
          </div>
        </>
      )}

      <div className="section-title"><h2>Records</h2></div>
      <button className="list row" onClick={openArchive} style={{ borderRadius: 18 }}>
        <span className="ico" aria-hidden="true"><IconArchive /></span>
        <span className="txt">
          <span className="t" style={{ display: 'block' }}>Insight Archive</span>
          <span className="d" style={{ display: 'block' }}>{discovered} declassified · {INSIGHTS.length - discovered} still classified</span>
        </span>
        <span className="end" aria-hidden="true"><IconChevronRight /></span>
      </button>

      <p className="footer-note">
        All intelligence is derived exclusively from your own history.<br />No comparisons to anyone else. No medical conclusions. Ever.
      </p>
    </>
  );
}

function ArchiveView({ back }: { back: () => void }) {
  const { archive, ctx, newInsightIds } = useOps();
  const [cat, setCat] = useState<Category | 'all'>('all');
  const inCat = (d: InsightDef) => cat === 'all' || d.category === cat;
  const found = Object.values(archive)
    .filter((a) => BY_ID.has(a.id) && inCat(BY_ID.get(a.id)!))
    .sort((a, b) => b.discoveredAt - a.discoveredAt);
  const hidden = INSIGHTS.filter((d) => !archive[d.id] && inCat(d));
  // Show a few tasteful mystery entries rather than a giant list.
  const teasers = hidden
    .slice()
    .sort((a, b) => (ctx.dailyRandom(`t-${a.id}`) < ctx.dailyRandom(`t-${b.id}`) ? -1 : 1))
    .slice(0, 6);

  return (
    <>
      <button className="btn btn-quiet back" onClick={back}>
        <IconChevronLeft /> Intelligence
      </button>
      <h1 className="page-title">Insight Archive</h1>
      <p className="page-sub">Every finding the Division has declassified. The rest remain classified until your data says otherwise.</p>

      <div className="chips" role="group" aria-label="Filter by department">
        <button className="chip" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{CATEGORY_LABEL[c]}</button>
        ))}
      </div>

      {found.length === 0 ? (
        <div className="card empty">
          <div className="big" aria-hidden="true">🗂️</div>
          <h3>Nothing declassified here yet</h3>
          <div>Keep recording. The Division is watching the data (and only the data).</div>
        </div>
      ) : (
        <div className="card-list">
          {found.map((a) => (
            <InsightCard key={a.id} def={BY_ID.get(a.id)!} text={a.text} isNew={newInsightIds.includes(a.id)} when={discoveredLabel(a.discoveredAt, ctx.todayKey)} />
          ))}
        </div>
      )}

      {hidden.length > 0 && (
        <>
          <div className="section-title">
            <h2>Still Classified</h2>
            <span className="aside">{hidden.length} remaining</span>
          </div>
          <div className="stack">
            {teasers.map((d) => (
              <div className="classified" key={d.id}>
                <span className="lock" aria-hidden="true"><IconLock /></span>
                <span>
                  <b>{d.rarity === 'common' ? '???' : 'CLASSIFIED'}</b>
                  <span>{CATEGORY_LABEL[d.category]} · {d.rarity === 'common' ? 'Insufficient intelligence' : RARITY_LABEL[d.rarity]}</span>
                </span>
              </div>
            ))}
            {hidden.length > teasers.length && (
              <div className="classified">
                <span className="lock" aria-hidden="true"><IconLock /></span>
                <span>
                  <b>+ {hidden.length - teasers.length} MORE</b>
                  <span>Insufficient intelligence. Discovery conditions are classified.</span>
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
