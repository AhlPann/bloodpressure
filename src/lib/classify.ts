/**
 * Einstufung nach ESH-Leitlinie 2023 (Praxismessung).
 * Maßgeblich ist jeweils die höhere Kategorie von systolischem und diastolischem Wert.
 */

export type Grade = 'optimal' | 'normal' | 'hochnormal' | 'grad1' | 'grad2' | 'grad3';

interface Level {
  grade: Grade;
  label: string;
  sys: number;
  dia: number;
}

const LEVELS: Level[] = [
  { grade: 'optimal', label: 'Optimal', sys: 0, dia: 0 },
  { grade: 'normal', label: 'Normal', sys: 120, dia: 80 },
  { grade: 'hochnormal', label: 'Hochnormal', sys: 130, dia: 85 },
  { grade: 'grad1', label: 'Hypertonie Grad 1', sys: 140, dia: 90 },
  { grade: 'grad2', label: 'Hypertonie Grad 2', sys: 160, dia: 100 },
  { grade: 'grad3', label: 'Hypertonie Grad 3', sys: 180, dia: 110 },
];

export interface Classification {
  grade: Grade;
  label: string;
}

export function classify(sys: number, dia: number): Classification {
  let idx = 0;
  LEVELS.forEach((l, i) => {
    if (sys >= l.sys || dia >= l.dia) idx = i;
  });
  return { grade: LEVELS[idx].grade, label: LEVELS[idx].label };
}

/** Schwellenwert für Selbstmessungen zu Hause (ESH): ab 135/85 gilt der Wert als erhöht. */
export const HOME_TARGET = { sys: 135, dia: 85 } as const;

export function aboveHomeTarget(sys: number, dia: number): boolean {
  return sys >= HOME_TARGET.sys || dia >= HOME_TARGET.dia;
}

export const DISCLAIMER =
  'Keine medizinische Beratung. Bitte besprechen Sie Ihre Werte und jede Änderung der Medikation mit Ihrem Arzt.';
