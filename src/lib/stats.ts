import { aboveHomeTarget } from './classify';
import { dayKey, daysBetweenInclusive, addDays, startOfDay } from './dates';
import type { Intake, Reading, Session } from './types';

export interface Avg {
  sys: number;
  dia: number;
  pulse?: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Mittelwert der Einzelmessungen einer Sitzung, auf ganze mmHg gerundet. */
export function sessionAverage(s: { readings: Reading[] }): Avg {
  const pulses = s.readings.map((r) => r.pulse).filter((p): p is number => typeof p === 'number');
  return {
    sys: Math.round(mean(s.readings.map((r) => r.sys))),
    dia: Math.round(mean(s.readings.map((r) => r.dia))),
    pulse: pulses.length ? Math.round(mean(pulses)) : undefined,
  };
}

export type DayPart = 'morgens' | 'tagsüber' | 'abends' | 'nachts';

/** morgens 04–12 Uhr, tagsüber 12–18 Uhr, abends 18–24 Uhr, nachts 0–4 Uhr */
export function dayPart(d: Date): DayPart {
  const h = d.getHours();
  if (h >= 4 && h < 12) return 'morgens';
  if (h >= 12 && h < 18) return 'tagsüber';
  if (h >= 18) return 'abends';
  return 'nachts';
}

export interface Summary {
  /** Anzahl Sitzungen */
  count: number;
  /** Anzahl Einzelmessungen */
  readingCount: number;
  /** Mittelwert über die Sitzungs-Mittelwerte */
  avg?: Avg;
  min?: Avg;
  max?: Avg;
  /** Anteil der Sitzungen mit Ø ≥ 135/85 (0–1) */
  aboveTargetShare: number;
}

export function summarize(sessions: Session[]): Summary {
  if (sessions.length === 0) return { count: 0, readingCount: 0, aboveTargetShare: 0 };
  const avgs = sessions.map(sessionAverage);
  const pulses = avgs.map((a) => a.pulse).filter((p): p is number => typeof p === 'number');
  const bySys = [...avgs].sort((a, b) => a.sys - b.sys || a.dia - b.dia);
  return {
    count: sessions.length,
    readingCount: sessions.reduce((n, s) => n + s.readings.length, 0),
    avg: {
      sys: Math.round(mean(avgs.map((a) => a.sys))),
      dia: Math.round(mean(avgs.map((a) => a.dia))),
      pulse: pulses.length ? Math.round(mean(pulses)) : undefined,
    },
    min: bySys[0],
    max: bySys[bySys.length - 1],
    aboveTargetShare: avgs.filter((a) => aboveHomeTarget(a.sys, a.dia)).length / avgs.length,
  };
}

/** Stunden seit der letzten Einnahme vor (oder genau zu) `t`; undefined, wenn keine vorher erfasst ist. */
export function hoursSinceLastIntake(t: Date, intakes: Intake[]): number | undefined {
  let last: number | undefined;
  for (const i of intakes) {
    const ti = i.takenAt.getTime();
    if (ti <= t.getTime() && (last === undefined || ti > last)) last = ti;
  }
  return last === undefined ? undefined : (t.getTime() - last) / 3_600_000;
}

export const INTAKE_BUCKETS = ['0–6 h', '6–12 h', '12–18 h', '18–24 h', 'über 24 h', 'keine Einnahme erfasst'] as const;
export type IntakeBucket = (typeof INTAKE_BUCKETS)[number];

/** Einteilung in 6-Stunden-Fenster; „18–24 h“ entspricht dem Wirkende vor der nächsten Tagesdosis. */
export function intakeBucket(hours: number | undefined): IntakeBucket {
  if (hours === undefined) return 'keine Einnahme erfasst';
  if (hours < 6) return '0–6 h';
  if (hours < 12) return '6–12 h';
  if (hours < 18) return '12–18 h';
  if (hours < 24) return '18–24 h';
  return 'über 24 h';
}

/** Gruppiert Sitzungen nach Abstand zur letzten Einnahme. Leere Gruppen werden weggelassen. */
export function summarizeByIntakeBucket(sessions: Session[], intakes: Intake[]): { bucket: IntakeBucket; summary: Summary }[] {
  const groups = new Map<IntakeBucket, Session[]>();
  for (const s of sessions) {
    const b = intakeBucket(hoursSinceLastIntake(s.takenAt, intakes));
    groups.set(b, [...(groups.get(b) ?? []), s]);
  }
  return INTAKE_BUCKETS.filter((b) => groups.has(b)).map((bucket) => ({ bucket, summary: summarize(groups.get(bucket)!) }));
}

/** Vergleicht Sitzungen an Kalendertagen mit und ohne erfasste Einnahme. */
export function compareIntakeDays(sessions: Session[], intakes: Intake[]): { withIntake: Summary; withoutIntake: Summary } {
  const days = new Set(intakes.map((i) => dayKey(i.takenAt)));
  return {
    withIntake: summarize(sessions.filter((s) => days.has(dayKey(s.takenAt)))),
    withoutIntake: summarize(sessions.filter((s) => !days.has(dayKey(s.takenAt)))),
  };
}

/** Einnahmetreue: an wie vielen Tagen im Zeitraum (höchstens bis heute) eine Einnahme erfasst ist. */
export function adherence(intakes: Intake[], from: Date, to: Date, now = new Date()): { days: number; taken: number } {
  const end = to.getTime() < now.getTime() ? to : now;
  const days = Math.max(0, daysBetweenInclusive(from, end));
  const keys = new Set(intakes.map((i) => dayKey(i.takenAt)));
  let taken = 0;
  for (let d = startOfDay(from), i = 0; i < days; i++, d = addDays(d, 1)) {
    if (keys.has(dayKey(d))) taken++;
  }
  return { days, taken };
}

export function inRange<T extends { takenAt: Date }>(items: T[], from: Date, to: Date): T[] {
  return items.filter((i) => i.takenAt >= from && i.takenAt <= to);
}
