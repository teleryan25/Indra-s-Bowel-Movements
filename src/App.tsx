import { useEffect, useState } from 'react';
import { OpsProvider, useOps } from './state/OpsContext';
import { BottomNav, TABS, type Tab } from './components/BottomNav';
import { Celebration } from './components/Celebration';
import { UpdateToast } from './components/UpdateToast';
import { TodayScreen } from './screens/TodayScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { IntelScreen } from './screens/IntelScreen';
import { AwardsScreen } from './screens/AwardsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import type { Store } from './storage/db';

const TAB_IDS = TABS.map((t) => t.id);
const readHash = (): Tab => {
  const h = window.location.hash.replace(/^#\/?/, '') as Tab;
  return TAB_IDS.includes(h) ? h : 'today';
};

function Shell() {
  const [tab, setTab] = useState<Tab>(readHash);
  const [scrolled, setScrolled] = useState(false);
  const { ready, newInsightIds, achievements, ctx } = useOps();
  const [seenIntel, setSeenIntel] = useState(0);
  const [seenAwards, setSeenAwards] = useState(0);

  useEffect(() => {
    const on = () => setTab(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const achCount = Object.keys(achievements).length;
  useEffect(() => { if (tab === 'intel') setSeenIntel(newInsightIds.length); }, [tab, newInsightIds.length]);
  useEffect(() => { if (tab === 'awards') setSeenAwards(achCount); }, [tab, achCount]);

  const go = (t: Tab) => {
    if (t !== tab) {
      window.history.replaceState(null, '', t === 'today' ? window.location.pathname : `#/${t}`);
      setTab(t);
    }
    window.scrollTo({ top: 0 });
  };

  const d = ctx.now;
  return (
    <div className="app">
      <header className={`topbar${scrolled ? ' scrolled' : ''}`}>
        <div className="topbar-inner">
          <img className="brandmark" src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={30} height={30} />
          <div className="brand-text">
            <div className="brand-name">Indra’s Bowel Operations Center™</div>
            <div className="brand-sub">Mission-critical digestive infrastructure</div>
          </div>
        </div>
      </header>
      <main className="screen" key={tab} id="main" aria-busy={!ready}>
        {!ready ? (
          <div className="empty" role="status"><div className="big" aria-hidden="true">🛰️</div>Establishing secure connection…</div>
        ) : tab === 'today' ? (
          <TodayScreen go={go} />
        ) : tab === 'calendar' ? (
          <CalendarScreen />
        ) : tab === 'intel' ? (
          <IntelScreen />
        ) : tab === 'awards' ? (
          <AwardsScreen />
        ) : (
          <SettingsScreen />
        )}
      </main>
      <BottomNav
        tab={tab}
        onChange={go}
        badges={{ intel: tab !== 'intel' && newInsightIds.length > seenIntel && ready, awards: tab !== 'awards' && seenAwards > 0 && achCount > seenAwards }}
      />
      <Celebration />
      <UpdateToast />
      <span className="sr-only" aria-live="polite">{d.toDateString()}</span>
    </div>
  );
}

export default function App({ storeFactory, clock }: { storeFactory?: () => Promise<Store>; clock?: () => Date }) {
  return (
    <OpsProvider storeFactory={storeFactory} clock={clock}>
      <Shell />
    </OpsProvider>
  );
}
