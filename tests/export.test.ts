import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BpDatabase, importBackup } from '../src/db';
import { parseBackupJson, toBackupJson, toCsv } from '../src/lib/export';
import { DEFAULT_SETTINGS, type Intake, type Session } from '../src/lib/types';

const sessions: Session[] = [
  { id: 1, takenAt: new Date(2026, 10, 1, 7, 30), arm: 'links', readings: [{ sys: 132, dia: 84, pulse: 66 }, { sys: 128, dia: 82 }] },
  { id: 2, takenAt: new Date(2026, 10, 1, 20, 15), arm: 'rechts', readings: [{ sys: 124, dia: 79, pulse: 70 }], note: 'nach Spaziergang; "ruhig"', tags: ['Sport'] },
];
const intakes: Intake[] = [{ id: 1, takenAt: new Date(2026, 10, 1, 8, 0), drug: 'Candecor', doseMg: 8 }];
const settings = { ...DEFAULT_SETTINGS, patientName: 'Test' };

describe('Backup JSON', () => {
  it('Roundtrip erhält alle Daten (ohne IDs)', () => {
    const parsed = parseBackupJson(toBackupJson({ sessions, intakes, settings }));
    expect(parsed.sessions).toEqual(sessions.map(({ id: _id, ...s }) => s));
    expect(parsed.intakes).toEqual(intakes.map(({ id: _id, ...i }) => i));
    expect(parsed.settings.patientName).toBe('Test');
    expect(parsed.sessions[0].takenAt).toBeInstanceOf(Date);
  });

  it('lehnt fremde oder kaputte Dateien ab', () => {
    expect(() => parseBackupJson('kein json')).toThrow(/keine gültige JSON/);
    expect(() => parseBackupJson('{"foo":1}')).toThrow(/kein Backup/);
    const bad = JSON.parse(toBackupJson({ sessions, intakes, settings }));
    bad.sessions[0].readings[0].sys = 999;
    expect(() => parseBackupJson(JSON.stringify(bad))).toThrow(/Messung 1/);
  });
});

describe('importBackup', () => {
  it('übernimmt Daten und überspringt Duplikate', async () => {
    const database = new BpDatabase('test-import');
    const data = parseBackupJson(toBackupJson({ sessions, intakes, settings }));
    expect(await importBackup(data, database)).toEqual({ sessions: 2, intakes: 1 });
    expect(await importBackup(data, database)).toEqual({ sessions: 0, intakes: 0 });
    expect(await database.sessions.count()).toBe(2);
    const stored = await database.sessions.orderBy('takenAt').first();
    expect(stored?.takenAt).toEqual(sessions[0].takenAt);
    await database.delete();
  });
});

describe('CSV', () => {
  it('erzeugt Excel-freundliches CSV', () => {
    const csv = toCsv(sessions, intakes);
    expect(csv.startsWith('﻿Datum;Uhrzeit;')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('01.11.2026;07:30;morgens;130;83;66;2;132/84 P66 | 128/82;links;;Hochnormal;;');
    expect(lines[2]).toContain('12,3');
    expect(lines[2]).toContain('"nach Spaziergang; ""ruhig"""');
  });
});
