export interface Reading {
  sys: number;
  dia: number;
  pulse?: number;
}

export type Arm = 'links' | 'rechts';

/** Eine Messsitzung mit 1–3 Einzelmessungen kurz hintereinander. */
export interface Session {
  id?: number;
  takenAt: Date;
  readings: Reading[];
  arm: Arm;
  note?: string;
  tags?: string[];
}

/** Eine erfasste Medikamenteneinnahme. */
export interface Intake {
  id?: number;
  takenAt: Date;
  drug: string;
  doseMg: number;
}

export interface Settings {
  id: 'settings';
  drugName: string;
  doseMg: number;
  /** Übliche Einnahmezeit, HH:mm */
  usualIntakeTime: string;
  defaultArm: Arm;
  /** Optional, erscheint im Arztbericht. */
  patientName: string;
  lastExportAt?: Date;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  drugName: 'Candecor',
  doseMg: 8,
  usualIntakeTime: '08:00',
  defaultArm: 'links',
  patientName: '',
};

export const QUICK_TAGS = ['Stress', 'Kaffee', 'Sport', 'Alkohol', 'Schlecht geschlafen', 'Kopfschmerzen'];
