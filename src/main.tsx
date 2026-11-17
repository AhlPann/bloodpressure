import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import './styles.css';

render(<App />, document.getElementById('app')!);

// Service Worker für Offline-Betrieb; Updates werden automatisch übernommen.
registerSW({ immediate: true });

// Chrome bitten, die Daten nicht automatisch zu löschen, wenn der Speicher knapp wird.
navigator.storage?.persisted?.().then((p) => {
  if (!p) navigator.storage.persist?.();
});
