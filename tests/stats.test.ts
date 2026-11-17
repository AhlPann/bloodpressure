import { describe, expect, it } from 'vitest';
import {
  adherence,
  compareIntakeDays,
  dayPart,
  hoursSinceLastIntake,
  intakeBucket,
  sessionAverage,
  summarize,
  summarizeByIntakeBucket,
} from '../src/lib/stats';
import type { Intake, Session } from '../src/lib/types';

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m);
const session = (takenAt: Date, ...readings: [number, number, number?][]): Session => ({
  takenAt,
  arm: 'links',
  readings: readings.map(([sys, dia, pulse]) => ({ sys, dia, pulse })),
});
const intake = (takenAt: Date): Intake => ({ takenAt, drug: 'Candecor', doseMg: 8 });

describe('sessionAverage', () => {
  it('mittelt und rundet', () => {
    expect(sessionAverage(session(at(1, 8), [130, 85, 70], [126, 82, 66], [125, 80, 65]))).toEqual({ sys: 127, dia: 82, pulse: 67 });
  });

  it('Puls nur aus vorhandenen Werten', () => {
    expect(sessionAverage(session(at(1, 8), [130, 80, 70], [120, 80]))).toEqual({ sys: 125, dia: 80, pulse: 70 });
    expect(sessionAverage(session(at(1, 8), [130, 80])).pulse).toBeUndefined();
  });
});

describe('dayPart', () => {
  it.each([
    [3, 'nachts'],
    [4, 'morgens'],
    [11, 'morgens'],
    [12, 'tagsüber'],
    [18, 'abends'],
    [23, 'abends'],
  ])('%i Uhr → %s', (h, part) => {
    expect(dayPart(at(1, h))).toBe(part);
  });
});

describe('summarize', () => {
  it('leer', () => {
    expect(summarize([])).toEqual({ count: 0, readingCount: 0, aboveTargetShare: 0 });
  });

  it('berechnet Ø, Min, Max und Anteil über Zielwert', () => {
    const s = summarize([
      session(at(1, 8), [120, 80, 60], [124, 82, 62]), // Ø 122/81
      session(at(1, 20), [140, 90, 70]),
      session(at(2, 8), [130, 84]),
    ]);
    expect(s.count).toBe(3);
    expect(s.readingCount).toBe(4);
    expect(s.avg).toEqual({ sys: 131, dia: 85, pulse: 66 });
    expect(s.min).toEqual({ sys: 122, dia: 81, pulse: 61 });
    expect(s.max).toEqual({ sys: 140, dia: 90, pulse: 70 });
    expect(s.aboveTargetShare).toBeCloseTo(1 / 3);
  });
});

describe('Medikamenten-Bezug', () => {
  const intakes = [intake(at(1, 8)), intake(at(2, 8)), intake(at(4, 9))];

  it('hoursSinceLastIntake nimmt die letzte vorherige Einnahme', () => {
    expect(hoursSinceLastIntake(at(1, 7), intakes)).toBeUndefined();
    expect(hoursSinceLastIntake(at(1, 8), intakes)).toBe(0);
    expect(hoursSinceLastIntake(at(1, 20), intakes)).toBe(12);
    expect(hoursSinceLastIntake(at(3, 20), intakes)).toBe(36);
  });

  it('intakeBucket', () => {
    expect(intakeBucket(undefined)).toBe('keine Einnahme erfasst');
    expect(intakeBucket(5.9)).toBe('0–6 h');
    expect(intakeBucket(6)).toBe('6–12 h');
    expect(intakeBucket(12.5)).toBe('12–18 h');
    expect(intakeBucket(23)).toBe('18–24 h');
    expect(intakeBucket(30)).toBe('über 24 h');
  });

  it('gruppiert nach Abstand zur Einnahme', () => {
    const groups = summarizeByIntakeBucket(
      [session(at(1, 7), [150, 95]), session(at(1, 10), [125, 80]), session(at(3, 20), [145, 92])],
      intakes,
    );
    expect(groups.map((g) => g.bucket)).toEqual(['0–6 h', 'über 24 h', 'keine Einnahme erfasst']);
  });

  it('vergleicht Tage mit und ohne Einnahme', () => {
    const r = compareIntakeDays([session(at(1, 20), [125, 80]), session(at(3, 20), [145, 92])], intakes);
    expect(r.withIntake.avg?.sys).toBe(125);
    expect(r.withoutIntake.avg?.sys).toBe(145);
  });

  it('adherence zählt Tage mit Einnahme bis heute', () => {
    expect(adherence(intakes, at(1, 0), at(10, 23), at(5, 12))).toEqual({ days: 5, taken: 3 });
  });
});
