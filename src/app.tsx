import { useEffect, useState } from 'preact/hooks';
import { Icon, type IconName } from './components/common';
import { Analysis } from './views/Analysis';
import { Capture } from './views/Capture';
import { History } from './views/History';
import { Report } from './views/Report';
import { Settings } from './views/Settings';

const TABS: { route: string; label: string; icon: IconName }[] = [
  { route: 'erfassen', label: 'Erfassen', icon: 'plus' },
  { route: 'verlauf', label: 'Verlauf', icon: 'list' },
  { route: 'auswertung', label: 'Auswertung', icon: 'chart' },
  { route: 'bericht', label: 'Bericht', icon: 'doc' },
  { route: 'einstellungen', label: 'Mehr', icon: 'settings' },
];

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => {
      setHash(location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export function App() {
  const [route = 'erfassen', param] = useHash().replace(/^#\/?/, '').split('/').filter(Boolean);
  const editId = param ? Number(param) : undefined;

  let view;
  switch (route) {
    case 'verlauf':
      view = <History />;
      break;
    case 'auswertung':
      view = <Analysis />;
      break;
    case 'bericht':
      view = <Report />;
      break;
    case 'einstellungen':
      view = <Settings />;
      break;
    default:
      view = <Capture key={editId ?? 'new'} editId={Number.isFinite(editId) ? editId : undefined} />;
  }

  const active = TABS.some((t) => t.route === route) ? route : 'erfassen';

  return (
    <>
      <main class="main">{view}</main>
      <nav class="tabbar no-print" aria-label="Hauptnavigation">
        {TABS.map((t) => (
          <a href={`#/${t.route}`} class={active === t.route ? 'tab active' : 'tab'} aria-current={active === t.route ? 'page' : undefined}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
