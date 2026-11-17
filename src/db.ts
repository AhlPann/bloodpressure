import Dexie, { liveQuery, type EntityTable } from 'dexie';
import { useEffect, useState } from 'preact/hooks';
import { DEFAULT_SETTINGS, type Intake, type Session, type Settings } from './lib/types';
import type { BackupData } from './lib/export';

export class BpDatabase extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  intakes!: EntityTable<Intake, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor(name = 'blutdruck-tagebuch') {
    super(name);
    this.version(1).stores({
      sessions: '++id, takenAt',
      intakes: '++id, takenAt',
      settings: 'id',
    });
  }
}

export const db = new BpDatabase();

export async function getSettings(database: BpDatabase = db): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await database.settings.get('settings')) };
}

export async function saveSettings(patch: Partial<Settings>, database: BpDatabase = db): Promise<void> {
  const current = await getSettings(database);
  await database.settings.put({ ...current, ...patch, id: 'settings' });
}

/**
 * Übernimmt ein Backup. Bestehende Daten bleiben erhalten; Einträge mit exakt gleichem
 * Zeitpunkt werden als Duplikat übersprungen. Gibt die Anzahl neu übernommener Einträge zurück.
 */
export async function importBackup(data: BackupData, database: BpDatabase = db): Promise<{ sessions: number; intakes: number }> {
  return database.transaction('rw', database.sessions, database.intakes, database.settings, async () => {
    const haveS = new Set((await database.sessions.toArray()).map((s) => s.takenAt.getTime()));
    const haveI = new Set((await database.intakes.toArray()).map((i) => i.takenAt.getTime()));
    const newS = data.sessions.filter((s) => !haveS.has(s.takenAt.getTime()));
    const newI = data.intakes.filter((i) => !haveI.has(i.takenAt.getTime()));
    await database.sessions.bulkAdd(newS);
    await database.intakes.bulkAdd(newI);
    if (!(await database.settings.get('settings'))) {
      await database.settings.put({ ...data.settings, id: 'settings' });
    }
    return { sessions: newS.length, intakes: newI.length };
  });
}

/** Reaktive Abfrage: liefert das Ergebnis und aktualisiert sich bei jeder Datenänderung. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<{ v: T } | undefined>(undefined);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: (v) => setValue({ v }),
      error: (e) => console.error(e),
    });
    return () => sub.unsubscribe();
  }, deps);
  return value?.v;
}
