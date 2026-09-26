import { useOps } from '../state/OpsContext';
import { ACHIEVEMENTS } from '../lib/achievements';
import { dayKey, fmtDay } from '../lib/dates';

export function AwardsScreen() {
  const { achievements, ctx } = useOps();
  const unlocked = ACHIEVEMENTS.filter((a) => achievements[a.id]);
  const nowMs = ctx.now.getTime();
  const sorted = [...ACHIEVEMENTS].sort((a, b) => {
    const ua = achievements[a.id] ?? 0;
    const ub = achievements[b.id] ?? 0;
    if (!!ua !== !!ub) return ua ? -1 : 1;
    return ub - ua;
  });

  return (
    <>
      <h1 className="page-title">Awards &amp; Commendations</h1>
      <p className="page-sub">Formal recognition for outstanding contributions to outbound logistics.</p>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="intel-stat" style={{ color: 'var(--muted)' }}>
          <span>Commendations earned</span>
          <span><b style={{ color: 'var(--ink)' }}>{unlocked.length}</b> of {ACHIEVEMENTS.length}</span>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={ACHIEVEMENTS.length} aria-valuenow={unlocked.length} aria-label="Achievements unlocked">
          <span style={{ width: `${Math.max(2, (unlocked.length / ACHIEVEMENTS.length) * 100)}%` }} />
        </div>
      </div>
      <div className="awards">
        {sorted.map((a) => {
          const at = achievements[a.id];
          const fresh = !!at && nowMs - at < 2 * 86400000;
          return (
            <div key={a.id} className={`award${at ? '' : ' locked'}${fresh ? ' fresh' : ''}`} aria-label={`${a.title}: ${at ? 'unlocked' : 'locked'}`}>
              <div className="medal" aria-hidden="true">{at ? a.icon : '🔒'}</div>
              <div className="t">{a.title}</div>
              <div className="d">{at ? a.description : a.hint}</div>
              <div className="date">{at ? `Unlocked ${fmtDay(dayKey(new Date(at)))}` : 'Locked'}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
