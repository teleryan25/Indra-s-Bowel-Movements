import { IconAwards, IconCalendar, IconIntel, IconSettings, IconToday } from './Icons';

export type Tab = 'today' | 'calendar' | 'intel' | 'awards' | 'settings';
export const TABS: { id: Tab; label: string; Icon: typeof IconToday }[] = [
  { id: 'today', label: 'Today', Icon: IconToday },
  { id: 'calendar', label: 'Calendar', Icon: IconCalendar },
  { id: 'intel', label: 'Intel', Icon: IconIntel },
  { id: 'awards', label: 'Awards', Icon: IconAwards },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
];

export function BottomNav({ tab, onChange, badges }: { tab: Tab; onChange: (t: Tab) => void; badges: Partial<Record<Tab, boolean>> }) {
  return (
    <nav className="tabbar" aria-label="Main">
      <ul>
        {TABS.map(({ id, label, Icon }) => (
          <li key={id} className="tab-wrap">
            <button className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => onChange(id)}>
              <Icon />
              <span>{label}</span>
            </button>
            {badges[id] && <span className="tab-badge" aria-label="New" />}
          </li>
        ))}
      </ul>
    </nav>
  );
}
