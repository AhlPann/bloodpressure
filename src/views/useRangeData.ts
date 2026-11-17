import type { Range } from '../components/common';
import { db, getSettings, useLive } from '../db';
import { addDays } from '../lib/dates';
import { inRange } from '../lib/stats';

/**
 * Lädt Sitzungen und Einnahmen eines Zeitraums. `intakesAll` enthält zusätzlich die Einnahmen
 * der zwei Tage davor, damit „Stunden seit Einnahme“ auch am ersten Tag stimmt.
 */
export function useRangeData({ from, to }: Range) {
  return useLive(async () => {
    const [sessions, intakesAll, settings] = await Promise.all([
      db.sessions.where('takenAt').between(from, to, true, true).sortBy('takenAt'),
      db.intakes.where('takenAt').between(addDays(from, -2), to, true, true).sortBy('takenAt'),
      getSettings(),
    ]);
    return { sessions, intakesAll, intakes: inRange(intakesAll, from, to), settings };
  }, [from.getTime(), to.getTime()]);
}
