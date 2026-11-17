import { useEffect, useState } from 'preact/hooks';
import { Card } from '../components/common';
import { db, getSettings, importBackup, saveSettings, useLive } from '../db';
import { DISCLAIMER } from '../lib/classify';
import { dayKey, formatDateTime } from '../lib/dates';
import { parseBackupJson, toBackupJson, toCsv } from '../lib/export';
import type { Arm, Settings as SettingsT } from '../lib/types';

const canShareFiles = () => {
  try {
    return !!navigator.canShare?.({ files: [new File([''], 'x.txt', { type: 'text/plain' })] });
  } catch {
    return false;
  }
};

/** Gibt eine Datei aus: per Teilen-Dialog (z. B. Drive, E-Mail) oder als Download. Liefert false bei Abbruch. */
async function deliver(file: File, mode: 'download' | 'share'): Promise<boolean> {
  if (mode === 'share') {
    try {
      await navigator.share({ files: [file], title: file.name });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
      throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

export function Settings() {
  const settings = useLive(() => getSettings());
  const counts = useLive(async () => ({ sessions: await db.sessions.count(), intakes: await db.intakes.count() }));
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [persisted, setPersisted] = useState<boolean>();
  const share = canShareFiles();

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  if (!settings || !counts) return null;

  const set = (patch: Partial<SettingsT>) => saveSettings(patch);

  async function exportJson(mode: 'download' | 'share') {
    try {
      const [sessions, intakes] = await Promise.all([db.sessions.orderBy('takenAt').toArray(), db.intakes.orderBy('takenAt').toArray()]);
      const file = new File([toBackupJson({ sessions, intakes, settings: settings! })], `blutdruck-backup-${dayKey(new Date())}.json`, { type: 'application/json' });
      if (await deliver(file, mode)) {
        await saveSettings({ lastExportAt: new Date() });
        setMessage({ kind: 'ok', text: `Backup mit ${sessions.length} Messungen und ${intakes.length} Einnahmen erstellt.` });
      }
    } catch (e) {
      setMessage({ kind: 'error', text: `Export fehlgeschlagen: ${(e as Error).message}` });
    }
  }

  async function exportCsv(mode: 'download' | 'share') {
    try {
      const [sessions, intakes] = await Promise.all([db.sessions.toArray(), db.intakes.toArray()]);
      const file = new File([toCsv(sessions, intakes)], `blutdruck-${dayKey(new Date())}.csv`, { type: 'text/csv' });
      if (await deliver(file, mode)) setMessage({ kind: 'ok', text: 'CSV-Datei erstellt.' });
    } catch (e) {
      setMessage({ kind: 'error', text: `Export fehlgeschlagen: ${(e as Error).message}` });
    }
  }

  async function onImport(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const data = parseBackupJson(await file.text());
      if (!confirm(`Die Datei enthält ${data.sessions.length} Messungen und ${data.intakes.length} Einnahmen. Übernehmen? Vorhandene Einträge bleiben erhalten, Duplikate werden übersprungen.`)) return;
      const added = await importBackup(data);
      setMessage({ kind: 'ok', text: `${added.sessions} Messungen und ${added.intakes} Einnahmen übernommen.` });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    }
  }

  async function requestPersist() {
    const ok = await navigator.storage?.persist?.();
    setPersisted(!!ok);
    if (!ok) setMessage({ kind: 'error', text: 'Der Browser hat dauerhaften Speicher abgelehnt. Installieren Sie die App auf dem Startbildschirm und versuchen Sie es erneut.' });
  }

  return (
    <>
      <header class="page-header">
        <h1>Einstellungen</h1>
      </header>

      <Card title="Medikament">
        <div class="form-grid">
          <label class="field">
            <span>Name</span>
            <input type="text" value={settings.drugName} onChange={(e) => set({ drugName: e.currentTarget.value.trim() || 'Candecor' })} />
          </label>
          <label class="field">
            <span>Dosis (mg)</span>
            <input type="text" inputMode="decimal" value={String(settings.doseMg).replace('.', ',')} onChange={(e) => {
              const v = Number(e.currentTarget.value.replace(',', '.'));
              if (Number.isFinite(v) && v > 0) set({ doseMg: v });
            }} />
          </label>
          <label class="field">
            <span>Übliche Einnahmezeit</span>
            <input type="time" value={settings.usualIntakeTime} onChange={(e) => e.currentTarget.value && set({ usualIntakeTime: e.currentTarget.value })} />
          </label>
        </div>
      </Card>

      <Card title="Messung & Bericht">
        <div class="field">
          <span>Standard-Arm</span>
          <div class="segmented" role="radiogroup" aria-label="Standard-Arm">
            {(['links', 'rechts'] as Arm[]).map((a) => (
              <button type="button" role="radio" aria-checked={settings.defaultArm === a} class={settings.defaultArm === a ? 'active' : ''} onClick={() => set({ defaultArm: a })}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <label class="field">
          <span>Name im Arztbericht (optional)</span>
          <input type="text" value={settings.patientName} autoComplete="name" onChange={(e) => set({ patientName: e.currentTarget.value.trim() })} />
        </label>
      </Card>

      <Card title="Datensicherung">
        <p class="small">
          Gespeichert: <strong>{counts.sessions}</strong> Messungen, <strong>{counts.intakes}</strong> Einnahmen.
          <br />
          Letzte Sicherung: {settings.lastExportAt ? formatDateTime(settings.lastExportAt) : 'noch nie'}
        </p>
        <div class="button-stack">
          <div class="btn-row">
            <button type="button" class="btn primary grow" onClick={() => exportJson('download')}>
              Backup herunterladen
            </button>
            {share && (
              <button type="button" class="btn grow" onClick={() => exportJson('share')}>
                Backup teilen…
              </button>
            )}
          </div>
          <div class="btn-row">
            <button type="button" class="btn grow" onClick={() => exportCsv('download')}>
              CSV für Excel
            </button>
            {share && (
              <button type="button" class="btn grow" onClick={() => exportCsv('share')}>
                CSV teilen…
              </button>
            )}
          </div>
          <label class="btn file-btn">
            Backup importieren
            <input type="file" accept="application/json,.json" onChange={onImport} />
          </label>
        </div>
        {message && (
          <div class={`alert ${message.kind === 'ok' ? 'alert-ok' : 'alert-error'}`} role="status">
            {message.text}
          </div>
        )}
        {share && (
          <p class="small muted">Tipp: Mit „Backup teilen…“ können Sie die Sicherung direkt in Google Drive ablegen oder sich per E-Mail schicken.</p>
        )}
      </Card>

      <Card title="Speicher & Datenschutz">
        <p class="small">
          Alle Werte werden ausschließlich auf diesem Gerät im Browser-Speicher abgelegt. Es werden keine Daten an einen Server übertragen.
        </p>
        <p class="small">
          Dauerhafter Speicher:{' '}
          {persisted === undefined ? 'unbekannt' : persisted ? <strong class="ok-text">aktiv</strong> : <strong class="warn-text">nicht aktiv</strong>}
          {persisted === false && (
            <button type="button" class="link-btn" onClick={requestPersist}>
              aktivieren
            </button>
          )}
        </p>
        <p class="small warn-text">
          Achtung: Wenn Sie die App deinstallieren oder die Website-Daten in Chrome löschen, gehen die Werte verloren. Erstellen Sie deshalb regelmäßig ein Backup.
        </p>
      </Card>

      <p class="disclaimer">{DISCLAIMER}</p>
      <p class="disclaimer">Blutdruck-Tagebuch · Version {__APP_VERSION__}</p>
    </>
  );
}
