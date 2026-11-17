import { describe, expect, it } from 'vitest';
import { aboveHomeTarget, classify } from '../src/lib/classify';
import { isEntryComplete, validateReading } from '../src/lib/validate';

describe('classify (ESH 2023)', () => {
  it.each([
    [119, 79, 'optimal'],
    [120, 70, 'normal'],
    [110, 80, 'normal'],
    [129, 84, 'normal'],
    [130, 70, 'hochnormal'],
    [120, 85, 'hochnormal'],
    [139, 89, 'hochnormal'],
    [140, 80, 'grad1'],
    [125, 90, 'grad1'],
    [159, 99, 'grad1'],
    [160, 85, 'grad2'],
    [150, 100, 'grad2'],
    [180, 90, 'grad3'],
    [130, 110, 'grad3'],
  ])('%i/%i → %s', (sys, dia, grade) => {
    expect(classify(sys, dia).grade).toBe(grade);
  });

  it('nimmt die höhere Kategorie', () => {
    expect(classify(118, 95).grade).toBe('grad1');
  });

  it('Heimmessungs-Schwelle 135/85', () => {
    expect(aboveHomeTarget(134, 84)).toBe(false);
    expect(aboveHomeTarget(135, 70)).toBe(true);
    expect(aboveHomeTarget(120, 85)).toBe(true);
  });
});

describe('validateReading', () => {
  it('akzeptiert normale Werte', () => {
    expect(validateReading({ sys: 128, dia: 82, pulse: 64 })).toEqual([]);
    expect(validateReading({ sys: 128, dia: 82 })).toEqual([]);
  });

  it('meldet fehlende und unplausible Werte', () => {
    expect(validateReading({ dia: 80 })).toContain('Systolischer Wert fehlt.');
    expect(validateReading({ sys: 300, dia: 80 })[0]).toMatch(/zwischen 60 und 260/);
    expect(validateReading({ sys: 120, dia: 80, pulse: 10 })[0]).toMatch(/Puls/);
  });

  it('verlangt SYS > DIA', () => {
    expect(validateReading({ sys: 80, dia: 90 })).toContain('Der systolische Wert muss größer als der diastolische sein.');
  });
});

describe('isEntryComplete', () => {
  it.each([
    ['1', false],
    ['12', false],
    ['128', true],
    ['2', false],
    ['21', false],
    ['8', false],
    ['82', true],
    ['64', true],
    ['', false],
  ])('%s → %s', (v, expected) => {
    expect(isEntryComplete(v)).toBe(expected);
  });
});
