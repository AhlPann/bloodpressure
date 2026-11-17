import { classify } from './classify';
import { formatDate, formatTime } from './dates';
import { dayPart, hoursSinceLastIntake, sessionAverage } from './stats';
import { DEFAULT_SETTINGS, type Intake, type Reading, type Session, type Settings } from './types';
import { validateReading } from './validate';

const APP_ID = 'blutdruck-tagebuch';

export interface BackupData {
  sessions: Session[];
  intakes: Intake[];
  settings: Settings;
}

/** Vollständiges Backup als JSON-Text (Datumswerte als ISO-Strings). */
export function toBackupJson({ sessions, intakes, settings }: BackupData, now = new Date()): string {
  const strip = <T extends { id?: number }>({ id: _id, ...rest }: T) => rest;
  return JSON.stringify(
    {
      app: APP_ID,
      version: 1,
      exportedAt: now.toISOString(),
      settings: { ...settings, lastExportAt: undefined },
      sessions: sessions.map(strip),
      intakes: intakes.map(strip),
    },
    null,
    2,
  );
}

function parseDate(v: unknown, what: string): Date {
  const d = typeof v === 'string' || typeof v === 'number' ? new Date(v) : undefined;
  if (!d || Number.isNaN(d.getTime())) throw new Error(`Ungültiges Datum in ${what}.`);
  return d;
}

/** Liest ein Backup ein und prüft es. Wirft einen Fehler mit deutscher Meldung, wenn die Datei nicht passt. */
export function parseBackupJson(text: string): BackupData {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist keine gültige JSON-Datei.');
  }
  if (!raw || raw.app !== APP_ID || raw.version !== 1) {
    throw new Error('Die Datei ist kein Backup des Blutdruck-Tagebuchs.');
  }
  if (!Array.isArray(raw.sessions) || !Array.isArray(raw.intakes)) {
    throw new Error('Das Backup ist unvollständig.');
  }

  const sessions: Session[] = raw.sessions.map((s: any, i: number) => {
    const where = `Messung ${i + 1}`;
    if (!Array.isArray(s.readings) || s.readings.length === 0) throw new Error(`${where} enthält keine Werte.`);
    const readings: Reading[] = s.readings.map((r: any) => {
      const reading: Reading = { sys: Number(r.sys), dia: Number(r.dia) };
      if (r.pulse !== undefined && r.pulse !== null) reading.pulse = Number(r.pulse);
      const errors = validateReading(reading);
      if (errors.length) throw new Error(`${where}: ${errors[0]}`);
      return reading;
    });
    const session: Session = {
      takenAt: parseDate(s.takenAt, where),
      readings,
      arm: s.arm === 'rechts' ? 'rechts' : 'links',
    };
    if (typeof s.note === 'string' && s.note) session.note = s.note;
    if (Array.isArray(s.tags)) session.tags = s.tags.filter((t: unknown) => typeof t === 'string');
    return session;
  });

  const intakes: Intake[] = raw.intakes.map((it: any, i: number) => ({
    takenAt: parseDate(it.takenAt, `Einnahme ${i + 1}`),
    drug: typeof it.drug === 'string' ? it.drug : DEFAULT_SETTINGS.drugName,
    doseMg: Number.isFinite(Number(it.doseMg)) ? Number(it.doseMg) : DEFAULT_SETTINGS.doseMg,
  }));

  const s = raw.settings ?? {};
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...(typeof s.drugName === 'string' && { drugName: s.drugName }),
    ...(Number.isFinite(Number(s.doseMg)) && { doseMg: Number(s.doseMg) }),
    ...(typeof s.usualIntakeTime === 'string' && { usualIntakeTime: s.usualIntakeTime }),
    ...((s.defaultArm === 'links' || s.defaultArm === 'rechts') && { defaultArm: s.defaultArm }),
    ...(typeof s.patientName === 'string' && { patientName: s.patientName }),
  };

  return { sessions, intakes, settings };
}

const csvCell = (v: string | number | undefined) => {
  const s = v === undefined ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV für Excel (deutsch: Semikolon als Trenner, UTF-8 mit BOM). */
export function toCsv(sessions: Session[], intakes: Intake[]): string {
  const header = [
    'Datum', 'Uhrzeit', 'Tageszeit', 'SYS', 'DIA', 'Puls', 'Anzahl Messungen', 'Einzelwerte',
    'Arm', 'Stunden seit Einnahme', 'Einstufung', 'Tags', 'Notiz',
  ];
  const rows = [...sessions]
    .sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime())
    .map((s) => {
      const avg = sessionAverage(s);
      const h = hoursSinceLastIntake(s.takenAt, intakes);
      return [
        formatDate(s.takenAt),
        formatTime(s.takenAt),
        dayPart(s.takenAt),
        avg.sys,
        avg.dia,
        avg.pulse,
        s.readings.length,
        s.readings.map((r) => `${r.sys}/${r.dia}${r.pulse ? ` P${r.pulse}` : ''}`).join(' | '),
        s.arm,
        h === undefined ? '' : h.toFixed(1).replace('.', ','),
        classify(avg.sys, avg.dia).label,
        (s.tags ?? []).join(', '),
        s.note ?? '',
      ].map(csvCell).join(';');
    });
  return '﻿' + [header.join(';'), ...rows].join('\r\n') + '\r\n';
}
