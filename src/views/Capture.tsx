import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { BpValue, Card, GradeBadge, Icon } from '../components/common';
import { db, getSettings, useLive } from '../db';
import { endOfDay, formatTime, fromLocalInput, startOfDay, toLocalInput } from '../lib/dates';
import { sessionAverage } from '../lib/stats';
import { QUICK_TAGS, type Arm, type Reading, type Session, type Settings } from '../lib/types';
import { isEntryComplete, validateReading } from '../lib/validate';

interface Row {
  sys: string;
  dia: string;
  pulse: string;
}
type Field = keyof Row;
const FIELDS: Field[] = ['sys', 'dia', 'pulse'];
const MAX_ROWS = 3;

const emptyRow = (): Row => ({ sys: '', dia: '', pulse: '' });
const isEmptyRow = (r: Row) => !r.sys && !r.dia && !r.pulse;
const toNum = (s: string) => (s.trim() === '' ? undefined : Number(s));
function toReading(r: Row): Partial<Reading> {
  const reading: Partial<Reading> = { sys: toNum(r.sys), dia: toNum(r.dia) };
  const pulse = toNum(r.pulse);
  if (pulse !== undefined) reading.pulse = pulse;
  return reading;
}

export function Capture({ editId }: { editId?: number }) {
  const settings = useLive(() => getSettings());
  const [takenAt, setTakenAt] = useState(() => toLocalInput(new Date()));
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [arm, setArm] = useState<Arm>();
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [toast, setToast] = useState<string>();
  const form = useRef<HTMLFormElement>(null);
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    if (editId === undefined) return;
    db.sessions.get(editId).then((s) => {
      if (!s) {
        location.hash = '#/verlauf';
        return;
      }
      setTakenAt(toLocalInput(s.takenAt));
      setRows(s.readings.map((r) => ({ sys: String(r.sys), dia: String(r.dia), pulse: r.pulse ? String(r.pulse) : '' })));
      setArm(s.arm);
      setNote(s.note ?? '');
      setTags(s.tags ?? []);
    });
  }, [editId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const effectiveArm: Arm = arm ?? settings?.defaultArm ?? 'links';
  const filled = rows.filter((r) => !isEmptyRow(r));
  const valid = filled.map(toReading).filter((r) => validateReading(r).length === 0) as Reading[];
  const preview = valid.length ? sessionAverage({ readings: valid }) : undefined;

  function focusCell(key: string | null) {
    const el = key ? form.current?.querySelector<HTMLInputElement>(`[data-cell="${key}"]`) : null;
    if (el) el.focus();
    else (document.activeElement as HTMLElement | null)?.blur();
  }

  function update(i: number, field: Field, raw: string) {
    const value = raw.replace(/\D/g, '').slice(0, 3);
    const grew = value.length > rows[i][field].length;
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
    if (grew && isEntryComplete(value)) {
      const f = FIELDS.indexOf(field);
      focusCell(f < 2 ? `${i}-${FIELDS[f + 1]}` : i + 1 < rows.length ? `${i + 1}-sys` : null);
    }
  }

  function addRow() {
    pendingFocus.current = `${rows.length}-sys`;
    setRows((rs) => [...rs, emptyRow()]);
  }

  // Neue Zeile direkt nach dem Rendern fokussieren.
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    focusCell(pendingFocus.current);
    pendingFocus.current = null;
  }, [rows.length]);

  function reset() {
    setTakenAt(toLocalInput(new Date()));
    setRows([emptyRow()]);
    setArm(undefined);
    setNote('');
    setTags([]);
    setErrors([]);
  }

  async function save(e: Event) {
    e.preventDefault();
    const errs: string[] = [];
    if (filled.length === 0) errs.push('Bitte mindestens eine Messung eingeben.');
    filled.forEach((r, i) => validateReading(toReading(r)).forEach((m) => errs.push(filled.length > 1 ? `Messung ${i + 1}: ${m}` : m)));
    const date = fromLocalInput(takenAt);
    if (Number.isNaN(date.getTime())) errs.push('Bitte Datum und Uhrzeit angeben.');
    else if (date.getTime() > Date.now() + 5 * 60_000) errs.push('Der Zeitpunkt liegt in der Zukunft.');
    setErrors(errs);
    if (errs.length) return;

    const session: Session = { takenAt: date, readings: filled.map(toReading) as Reading[], arm: effectiveArm };
    if (note.trim()) session.note = note.trim();
    if (tags.length) session.tags = tags;

    if (editId !== undefined) {
      await db.sessions.put({ ...session, id: editId });
      location.hash = '#/verlauf';
      return;
    }
    await db.sessions.add(session);
    const a = sessionAverage(session);
    setToast(`Gespeichert: ${a.sys}/${a.dia} mmHg${session.readings.length > 1 ? ` (Ø aus ${session.readings.length} Messungen)` : ''}`);
    reset();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove() {
    if (editId === undefined || !confirm('Diese Messung wirklich löschen?')) return;
    await db.sessions.delete(editId);
    location.hash = '#/verlauf';
  }

  const toggleTag = (t: string) => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));

  return (
    <>
      <header class="page-header">
        <h1>{editId === undefined ? 'Messung erfassen' : 'Messung bearbeiten'}</h1>
      </header>

      {editId === undefined && settings && (
        <>
          <BackupReminder settings={settings} />
          <IntakeCard settings={settings} />
        </>
      )}

      <form ref={form} onSubmit={save} noValidate>
        <Card>
          <label class="field">
            <span>Zeitpunkt</span>
            <input type="datetime-local" value={takenAt} onInput={(e) => setTakenAt(e.currentTarget.value)} required />
          </label>

          <div class="readings">
            <div class="reading-head" aria-hidden="true">
              <span />
              <span>SYS</span>
              <span>DIA</span>
              <span>Puls</span>
            </div>
            {rows.map((r, i) => (
              <div class="reading-row" key={i}>
                <span class="reading-no">{rows.length > 1 ? `${i + 1}.` : ''}</span>
                {FIELDS.map((f) => (
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint="next"
                    maxLength={3}
                    autoComplete="off"
                    class="num"
                    data-cell={`${i}-${f}`}
                    aria-label={`${f === 'sys' ? 'Systolisch' : f === 'dia' ? 'Diastolisch' : 'Puls'}${rows.length > 1 ? `, Messung ${i + 1}` : ''}`}
                    placeholder={f === 'sys' ? '120' : f === 'dia' ? '80' : '70'}
                    value={r[f]}
                    onInput={(e) => update(i, f, e.currentTarget.value)}
                  />
                ))}
                {i > 0 ? (
                  <button type="button" class="icon-btn" aria-label={`Messung ${i + 1} entfernen`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                    ×
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
            {rows.length < MAX_ROWS && (
              <button type="button" class="link-btn" onClick={addRow}>
                + weitere Messung
              </button>
            )}
          </div>

          {preview && (
            <div class="preview" aria-live="polite">
              <span class="muted">{valid.length > 1 ? `Mittelwert aus ${valid.length} Messungen` : 'Wert'}</span>
              <BpValue avg={preview} large />
              <GradeBadge sys={preview.sys} dia={preview.dia} />
            </div>
          )}
        </Card>

        <Card>
          <div class="field">
            <span>Arm</span>
            <div class="segmented" role="radiogroup" aria-label="Arm">
              {(['links', 'rechts'] as Arm[]).map((a) => (
                <button type="button" role="radio" aria-checked={effectiveArm === a} class={effectiveArm === a ? 'active' : ''} onClick={() => setArm(a)}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div class="field">
            <span>Besonderheiten</span>
            <div class="chips">
              {QUICK_TAGS.map((t) => (
                <button type="button" class={tags.includes(t) ? 'chip active' : 'chip'} aria-pressed={tags.includes(t)} onClick={() => toggleTag(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <label class="field">
            <span>Notiz</span>
            <textarea rows={2} value={note} placeholder="optional" onInput={(e) => setNote(e.currentTarget.value)} />
          </label>
        </Card>

        {errors.length > 0 && (
          <div class="alert alert-error" role="alert">
            {errors.map((m) => (
              <div>{m}</div>
            ))}
          </div>
        )}

        <div class="actions">
          {editId !== undefined && (
            <>
              <button type="button" class="btn danger" onClick={remove}>
                Löschen
              </button>
              <a class="btn" href="#/verlauf">
                Abbrechen
              </a>
            </>
          )}
          <button type="submit" class="btn primary grow">
            Speichern
          </button>
        </div>
      </form>

      {toast && (
        <div class="toast" role="status">
          <Icon name="check" size={20} /> {toast}
        </div>
      )}
    </>
  );
}

function IntakeCard({ settings }: { settings: Settings }) {
  const today = useLive(() => db.intakes.where('takenAt').between(startOfDay(new Date()), endOfDay(new Date()), true, true).sortBy('takenAt'));
  const [custom, setCustom] = useState(false);
  const [time, setTime] = useState(settings.usualIntakeTime);
  const label = `${settings.drugName} ${settings.doseMg} mg`;

  async function record(at: Date) {
    await db.intakes.add({ takenAt: at, drug: settings.drugName, doseMg: settings.doseMg });
    setCustom(false);
  }

  function recordCustom() {
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    record(d);
  }

  if (!today) return null;
  if (today.length > 0) {
    return (
      <div class="intake-card done">
        <Icon name="pill" />
        <div>
          <strong>{label}</strong> heute um {today.map((i) => formatTime(i.takenAt)).join(', ')} Uhr eingenommen
          <div>
            <a href="#/verlauf" class="small">
              ändern
            </a>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div class="intake-card open">
      <div class="intake-text">
        <Icon name="pill" />
        <span>Heute noch keine Einnahme von {label} erfasst.</span>
      </div>
      {custom ? (
        <div class="intake-custom">
          <input type="time" value={time} onInput={(e) => setTime(e.currentTarget.value)} aria-label="Uhrzeit der Einnahme" />
          <button type="button" class="btn primary" onClick={recordCustom}>
            Speichern
          </button>
          <button type="button" class="btn" onClick={() => setCustom(false)}>
            Abbrechen
          </button>
        </div>
      ) : (
        <div class="intake-actions">
          <button type="button" class="btn intake-btn" onClick={() => record(new Date())}>
            Jetzt eingenommen
          </button>
          <button type="button" class="link-btn" onClick={() => setCustom(true)}>
            andere Uhrzeit
          </button>
        </div>
      )}
    </div>
  );
}

function BackupReminder({ settings }: { settings: Settings }) {
  const count = useLive(() => db.sessions.count());
  if (count === undefined || count < 5) return null;
  const last = settings.lastExportAt;
  const days = last ? Math.floor((Date.now() - last.getTime()) / 86_400_000) : undefined;
  if (days !== undefined && days <= 30) return null;
  return (
    <a class="alert alert-warn backup-reminder" href="#/einstellungen">
      {days === undefined ? 'Sie haben noch keine Datensicherung erstellt.' : `Letzte Datensicherung vor ${days} Tagen.`} Jetzt sichern →
    </a>
  );
}
