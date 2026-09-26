import type { InsightDef } from '../insights/types';
import { CATEGORY_LABEL } from '../insights/types';
import { RARITY_LABEL } from '../insights/engine';

export function InsightCard({ def, text, isNew, when }: { def: InsightDef; text: string; isNew?: boolean; when?: string }) {
  return (
    <article className={`insight ${def.rarity} ${def.category}`} aria-label={def.title}>
      <div className="meta">
        <span className="cat">{def.category === 'partnership' ? '❤︎ ' : ''}{CATEGORY_LABEL[def.category]}</span>
        <span className={`rarity ${def.rarity}`}>{RARITY_LABEL[def.rarity]}</span>
        {isNew && <span className="new-badge">NEW</span>}
      </div>
      <h3>{def.title}</h3>
      <p>{text}</p>
      {when && <div className="when">{when}</div>}
    </article>
  );
}
