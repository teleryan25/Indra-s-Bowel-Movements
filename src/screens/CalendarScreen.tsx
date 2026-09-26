import { useState } from 'react';
import { useOps } from '../state/OpsContext';
import { daysInMonth, dayKey, fmtClock, fmtDay, MONTHS, WEEKDAYS_SHORT, monthKey } from '../lib/dates';
import { IconChevronLeft, IconChevronRight, IconTrash } from '../components/Icons';
import { Confirm, Sheet } from '../components/Overlay';
import type { Ev } from '../lib/stats';

export function monthMatrix(y: number, m: number): (number | null)[] {
  const first = new Date(y, m, 1).getDay();
  const dim = daysInMonth(y, m);
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function CalendarScreen() {
  const { ctx } = useOps();
  const [view, setView] = useState(() => ({ y: ctx.now.getFullYear(), m: ctx.now.getMonth() }));
  const [selected, setSelected] = useState<string | null>(null);

  const shift = (delta: number) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const isCurrent = view.y === ctx.now.getFullYear() && view.m === ctx.now.getMonth();
  const cells = monthMatrix(view.y, view.m);
  const mk = monthKey(view.y, view.m);
  const monthDays = ctx.days.filter((d) => d.key.startsWith(mk));
  const monthEvents = monthDays.reduce((a, d) => a + d.count, 0);
  const best = monthDays.reduce((a, d) => Math.max(a, d.count), 0);

  return (
    <>
      <div className="cal-head">
        <h1 aria-live="polite">
          {MONTHS[view.m]} <span>{view.y}</span>
        </h1>
        {!isCurrent && (
          <button className="btn btn-quiet" onClick={() => setView({ y: ctx.now.getFullYear(), m: ctx.now.getMonth() })}>
            Today
          </button>
        )}
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
          <IconChevronLeft />
        </button>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
          <IconChevronRight />
        </button>
      </div>

      <div className="cal-card">
        <div className="cal-grid" role="grid" aria-label={`${MONTHS[view.m]} ${view.y}`}>
          <div role="row" style={{ display: 'contents' }}>
            {WEEKDAYS_SHORT.map((w) => (
              <div className="cal-dow" role="columnheader" key={w} aria-label={w}>
                {w.charAt(0)}
              </div>
            ))}
          </div>
          {chunk(cells, 7).map((week, wi) => (
            <div role="row" style={{ display: 'contents' }} key={wi}>
              {week.map((d, i) => {
                if (d === null) return <div className="cal-cell out" role="gridcell" aria-hidden="true" key={`o${wi}-${i}`} />;
                const key = dayKey(new Date(view.y, view.m, d));
                const rec = ctx.dayMap.get(key);
                const count = rec?.count ?? 0;
                const future = key > ctx.todayKey;
                const cls = ['cal-cell', count ? 'has' : '', count > 1 ? 'multi' : '', key === ctx.todayKey ? 'today' : '', future ? 'future' : '', selected === key ? 'selected' : '']
                  .filter(Boolean)
                  .join(' ');
                const label = `${fmtDay(key)}${key === ctx.todayKey ? ', today' : ''}: ${count === 0 ? 'no movements' : `${count} movement${count > 1 ? 's' : ''}`}`;
                return (
                  <button role="gridcell" className={cls} key={key} onClick={() => setSelected(key)} aria-label={label}>
                    <span className="num">{d}</span>
                    {count > 0 && <span className="poo" aria-hidden="true">💩</span>}
                    {count > 1 && <span className="mult" aria-hidden="true">×{count}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="cal-summary">
        <div className="metric"><div className="k">Active days</div><div className="v">{monthDays.length}</div></div>
        <div className="metric"><div className="k">Movements</div><div className="v">{monthEvents}</div></div>
        <div className="metric"><div className="k">Best day</div><div className="v">{best ? `× ${best}` : '—'}</div></div>
      </div>

      {selected && <DaySheet dayKeyStr={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

function defaultTime(isToday: boolean) {
  if (!isToday) return '09:00';
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function DaySheet({ dayKeyStr, onClose }: { dayKeyStr: string; onClose: () => void }) {
  const { ctx, deleteEvent, addPastEvent } = useOps();
  const rec = ctx.dayMap.get(dayKeyStr);
  const [confirm, setConfirm] = useState<Ev | null>(null);
  const [time, setTime] = useState(() => defaultTime(dayKeyStr === ctx.todayKey));
  const [note, setNote] = useState<string | null>(null);
  const future = dayKeyStr > ctx.todayKey;
  const isToday = dayKeyStr === ctx.todayKey;

  const add = async () => {
    const [h, m] = time.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return;
    const ok = await addPastEvent(dayKeyStr, h * 60 + m);
    setNote(ok ? `Movement logged at ${fmtClock(h * 60 + m)}.` : isToday && h * 60 + m > ctx.now.getHours() * 60 + ctx.now.getMinutes() ? "That time hasn't happened yet." : 'A movement is already logged at that time.');
  };

  const count = rec?.count ?? 0;
  return (
    <Sheet title={fmtDay(dayKeyStr)} subtitle={count ? `${count} movement${count > 1 ? 's' : ''} recorded` : future ? 'This day hasn’t happened yet' : 'No movements recorded'} onClose={onClose}>
      {rec && (
        <div className="list" style={{ marginBottom: 16 }}>
          {rec.events.map((e, i) => (
            <div className="ev-row" key={e.id}>
              <div className="txt">
                <div className="time">{fmtClock(e.mins)}</div>
                <div className="label">{i === 0 ? 'First movement' : `Movement #${i + 1}`} · Delivery confirmed</div>
              </div>
              <button className="del" onClick={() => setConfirm(e)} aria-label={`Delete the ${fmtClock(e.mins)} movement`}>
                <IconTrash />
              </button>
            </div>
          ))}
        </div>
      )}

      {!future && (
        <div className="card" style={{ boxShadow: 'none' }}>
          <div className="field">
            <label htmlFor="add-time">{count ? 'Forgot one? Add another movement' : 'Forgot to log it? Add a movement'}</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input id="add-time" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={add}>Add</button>
            </div>
          </div>
          {note && <p role="status" style={{ margin: '10px 2px 0', fontSize: 14, color: 'var(--muted)' }}>{note}</p>}
        </div>
      )}
      {future && <p style={{ color: 'var(--muted)' }}>The Intelligence Division does not do forecasts for specific future dates. Please check back when this day arrives.</p>}

      {confirm && (
        <Confirm
          title="Delete this movement?"
          body={`The ${fmtClock(confirm.mins)} movement on ${fmtDay(dayKeyStr)} will be removed from your history. This can’t be undone.`}
          confirmLabel="Delete Movement"
          cancelLabel="Keep It"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const id = confirm.id;
            setConfirm(null);
            await deleteEvent(id);
            setNote('Movement deleted.');
          }}
        />
      )}
    </Sheet>
  );
}
