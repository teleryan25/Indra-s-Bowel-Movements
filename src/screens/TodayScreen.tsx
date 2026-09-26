import { useMemo, useState } from 'react';
import { useOps } from '../state/OpsContext';
import { summarize, DAYPART_LABEL, hashString } from '../lib/stats';
import { fmtClock, relativeDay, WEEKDAYS, MONTHS } from '../lib/dates';
import { pickNoMessage, STATUS_COPY } from '../lib/copy';
import { selectBriefing } from '../insights/engine';
import { InsightCard } from '../components/InsightCard';
import { IconChevronRight, IconPlus } from '../components/Icons';
import type { Tab } from '../components/BottomNav';

function greeting(h: number) {
  if (h < 5) return 'Working late, Indra';
  if (h < 12) return 'Good morning, Indra';
  if (h < 17) return 'Good afternoon, Indra';
  return 'Good evening, Indra';
}

export function TodayScreen({ go }: { go: (t: Tab) => void }) {
  const { ctx, recordPoop, recordNo, saidNoToday, results, archive, ready } = useOps();
  const s = summarize(ctx);
  const [busy, setBusy] = useState(false);
  const today = ctx.dayMap.get(ctx.todayKey);
  const status = STATUS_COPY[s.status];

  const briefing = useMemo(() => selectBriefing(results, archive, ctx, ctx.now.getTime(), 1), [results, archive, ctx]);

  const record = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await recordPoop();
    } finally {
      setTimeout(() => setBusy(false), 600);
    }
  };

  const noMsg = pickNoMessage(hashString(ctx.todayKey));
  const lastLabel = s.lastTs ? `${relativeDay(ctx.last!.key, ctx.todayKey)}, ${fmtClock(ctx.last!.mins)}` : '—';
  const d = ctx.now;

  return (
    <>
      <h1 className="sr-only">Today</h1>
      <div className="eyebrow" style={{ margin: '14px 4px 2px' }}>
        {WEEKDAYS[d.getDay()]}, {MONTHS[d.getMonth()]} {d.getDate()}
      </div>
      <div className="page-title" style={{ marginTop: 2, fontSize: 26 }}>{greeting(d.getHours())}</div>

      {/* Hero: the only question that matters */}
      <section className="hero" aria-live="polite" style={{ marginTop: 14 }}>
        {today ? (
          <>
            <div className="eyebrow"><span className="pulse good" aria-hidden="true" />Movement confirmed</div>
            <div className="hero-title">Mission accomplished.</div>
            <div className="hero-count">
              <div className="n" aria-hidden="true">{today.count}</div>
              <div className="l">Today's successful<br />deployments</div>
              <span className="sr-only">Today's successful deployments: {today.count}</span>
            </div>
            <div className="hero-times" aria-label="Times recorded today">
              {today.events.map((e) => (
                <span className="chip-time" key={e.id}>{fmtClock(e.mins)}</span>
              ))}
            </div>
            <div className="hero-actions">
              <button className="btn btn-block btn-ghost-dark" onClick={record} disabled={busy || !ready}>
                <IconPlus width={20} height={20} /> Record another
              </button>
            </div>
          </>
        ) : saidNoToday ? (
          <>
            <div className="eyebrow"><span className="pulse" aria-hidden="true" />Standby mode</div>
            <div className="hero-title">{noMsg.title}</div>
            <p className="hero-lede">{noMsg.body}</p>
            <div className="hero-actions">
              <button className="btn btn-block btn-hero" onClick={record} disabled={busy || !ready}>
                <span className="emoji" aria-hidden="true">💩</span> Actually, I did the thing
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="eyebrow"><span className="pulse" aria-hidden="true" />Daily operations check</div>
            <h2 className="hero-question">Did you <em>poop</em> today?</h2>
            <p className="hero-lede">Mission-critical digestive infrastructure. One tap is all it takes.</p>
            <div className="hero-actions">
              <button className="btn btn-block btn-hero" onClick={record} disabled={busy || !ready}>
                <span className="emoji" aria-hidden="true">💩</span> YES, I DID THE THING
              </button>
              <button className="btn btn-block btn-ghost-dark" onClick={recordNo} disabled={!ready}>
                <span aria-hidden="true">😔</span> No. Send help.
              </button>
            </div>
          </>
        )}
      </section>

      <div className="section-title">
        <h2>Performance Metrics</h2>
        <span className={`pill ${status.tone}`}><span className="d" aria-hidden="true" />{status.label}</span>
      </div>

      <div className="metrics">
        <Metric k="System Status" v={status.label} small s={s.todayCount ? 'Movement confirmed today' : s.lifetime ? 'Awaiting today’s deployment' : 'Ready for first deployment'} />
        <Metric k="Current Streak" v={s.currentStreak} unit={s.currentStreak === 1 ? 'day' : 'days'} s="Consecutive days with a movement" feature />
        <Metric k="Last Movement" v={lastLabel} small s={s.daysSinceLast === null ? 'No movements yet' : s.daysSinceLast === 0 ? 'Operations current' : `${s.daysSinceLast} day${s.daysSinceLast === 1 ? '' : 's'} since last movement`} />
        <Metric k="Monthly Throughput" v={s.monthEvents} unit={s.monthEvents === 1 ? 'deployment' : 'deployments'} s={`${s.monthPoopDays} active day${s.monthPoopDays === 1 ? '' : 's'} in ${MONTHS[d.getMonth()]}`} />
        <Metric k="Weekly Run Rate" v={s.avgPoopDaysPerWeek === null ? '—' : s.avgPoopDaysPerWeek.toFixed(1)} unit={s.avgPoopDaysPerWeek === null ? '' : 'days/wk'} s={s.avgEventsPerWeek === null ? 'Available after one week' : `${s.avgEventsPerWeek.toFixed(1)} movements per week`} />
        <Metric k="Lifetime" v={s.lifetime} unit={s.lifetime === 1 ? 'movement' : 'movements'} s="Documented since launch" />
        <Metric k="Peak Weekday" v={s.topWeekday === null ? '—' : WEEKDAYS[s.topWeekday]} small s={s.topWeekday === null ? 'Needs a few more days' : 'Most movements recorded'} />
        <Metric k="Peak Shift" v={s.topDaypart === null ? '—' : cap(DAYPART_LABEL[s.topDaypart].split(' (')[0])} small s={s.topDaypart === null ? 'Needs a few more days' : DAYPART_LABEL[s.topDaypart].split(' (')[1]?.replace(')', '') ?? ''} />
        <Metric k="Longest Streak" v={s.longestStreak} unit={s.longestStreak === 1 ? 'day' : 'days'} s="All-time record" />
        <Metric k="Longest Pause" v={s.longestGap} unit={s.longestGap === 1 ? 'day' : 'days'} s="Between active days" />
      </div>

      {briefing[0] && (
        <>
          <div className="section-title"><h2>Intelligence Briefing</h2></div>
          <button className="teaser" onClick={() => go('intel')} aria-label="Open the Bowel Intelligence Division">
            <InsightCard def={briefing[0].def} text={briefing[0].text} />
          </button>
          <div className="link-row" style={{ margin: '10px 4px 0' }}>
            <button className="btn-quiet btn" onClick={() => go('intel')} style={{ paddingLeft: 0 }}>
              More from the Intelligence Division <IconChevronRight width={16} height={16} />
            </button>
          </div>
        </>
      )}
    </>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Metric({ k, v, unit, s, small, feature }: { k: string; v: string | number; unit?: string; s?: string; small?: boolean; feature?: boolean }) {
  return (
    <div className={`metric${feature ? ' feature' : ''}`}>
      <div className="k">{k}</div>
      <div className={`v${small ? ' sm' : ''}`}>
        {v}
        {unit ? <small>{unit}</small> : null}
      </div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}
