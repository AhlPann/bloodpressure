import type { Reading } from './types';

export const LIMITS = {
  sys: [60, 260],
  dia: [30, 160],
  pulse: [30, 220],
} as const;

/** Prüft eine Einzelmessung auf plausible Werte. Gibt deutsche Fehlermeldungen zurück. */
export function validateReading(r: Partial<Reading>): string[] {
  const errors: string[] = [];
  const check = (v: number | undefined, key: keyof typeof LIMITS, name: string, required: boolean) => {
    if (v === undefined || Number.isNaN(v)) {
      if (required) errors.push(`${name} fehlt.`);
      return;
    }
    const [min, max] = LIMITS[key];
    if (!Number.isInteger(v) || v < min || v > max) errors.push(`${name} muss zwischen ${min} und ${max} liegen.`);
  };
  check(r.sys, 'sys', 'Systolischer Wert', true);
  check(r.dia, 'dia', 'Diastolischer Wert', true);
  check(r.pulse, 'pulse', 'Puls', false);
  if (r.sys !== undefined && r.dia !== undefined && !Number.isNaN(r.sys) && !Number.isNaN(r.dia) && r.sys <= r.dia) {
    errors.push('Der systolische Wert muss größer als der diastolische sein.');
  }
  return errors;
}

/**
 * Ob eine Eingabe vollständig ist und der Fokus ins nächste Feld springen darf.
 * Werte beginnend mit 1 oder 2 sind dreistellig (100–260), alle anderen zweistellig (30–99).
 */
export function isEntryComplete(v: string): boolean {
  if (!/^\d+$/.test(v)) return false;
  if (v[0] === '1' || v[0] === '2') return v.length >= 3;
  return v.length >= 2;
}
