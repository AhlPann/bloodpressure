/** Datums-Hilfsfunktionen. Alle Berechnungen in lokaler Zeit. */

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → Wert für <input type="datetime-local"> (YYYY-MM-DDTHH:mm). */
export function toLocalInput(d: Date): string {
  return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Wert aus <input type="datetime-local"> → Date (lokale Zeit). */
export function fromLocalInput(s: string): Date {
  const [date, time = '00:00'] = s.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

/** Date → Wert für <input type="date"> bzw. Schlüssel für einen Kalendertag. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDayKey(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Anzahl Kalendertage von `from` bis `to` (beide inklusive). */
export function daysBetweenInclusive(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

const fmtDate = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtTime = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtDayLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const formatDate = (d: Date) => fmtDate.format(d);
export const formatTime = (d: Date) => fmtTime.format(d);
export const formatDayLong = (d: Date) => fmtDayLong.format(d);
export const formatDateTime = (d: Date) => `${fmtDate.format(d)}, ${fmtTime.format(d)}`;
