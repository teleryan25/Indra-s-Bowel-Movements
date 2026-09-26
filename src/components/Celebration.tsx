import { useEffect } from 'react';
import { useOps } from '../state/OpsContext';
import { Confetti } from './Confetti';

/** The unreasonably important moment after recording a movement. */
export function Celebration() {
  const { celebration, dismissCelebration, reducedMotion, settings } = useOps();

  useEffect(() => {
    if (!celebration) return;
    const hasAch = celebration.achievements.length > 0;
    const ms = !settings.celebrations ? (hasAch ? 3200 : 2000) : hasAch ? 4200 : 2600;
    const t = setTimeout(dismissCelebration, ms);
    try {
      navigator.vibrate?.(settings.celebrations ? [18, 40, 28] : 12);
    } catch {
      /* not supported on iPhone; harmless */
    }
    return () => clearTimeout(t);
  }, [celebration, dismissCelebration, settings.celebrations]);

  if (!celebration) return null;
  const { headline, count, achievements } = celebration;
  const countLine = `Today's successful deployments: ${count}`;

  if (!settings.celebrations) {
    return (
      <div className="toast" role="status" aria-live="polite" onClick={dismissCelebration}>
        <span>✓ Movement confirmed · {count} today{achievements.length ? ` · 🏅 ${achievements.map((a) => a.title).join(', ')}` : ''}</span>
      </div>
    );
  }

  return (
    <div className="celebrate" role="alertdialog" aria-modal="true" aria-label={headline} onClick={dismissCelebration}>
      {!reducedMotion && <Confetti />}
      <div className="celebrate-card">
        <div className="celebrate-emoji" aria-hidden="true">💩</div>
        <div className="celebrate-kicker">MOVEMENT CONFIRMED</div>
        <div className="celebrate-headline" role="status" aria-live="assertive">{headline}</div>
        <div className="celebrate-sub">{countLine}</div>
        {achievements.length > 0 && (
          <div className="celebrate-ach">
            {achievements.map((a) => (
              <div className="a" key={a.id}>
                <span className="i" aria-hidden="true">{a.icon}</span>
                <span>
                  <small>ACHIEVEMENT UNLOCKED</small>
                  <b>{a.title}</b>
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="celebrate-dismiss">Tap anywhere to continue</div>
      </div>
    </div>
  );
}
