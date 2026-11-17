import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../components/common';
import { db, useLive } from '../db';
import { classify } from '../lib/classify';
import { addDays, dayKey, formatDayLong, formatTime, fromLocalInput, startOfDay, toLocalInput } from '../lib/dates';
import { sessionAverage } from '../lib/stats';
import type { Intake, Session } from '../lib/types';

type Entry = { kind: 'session'; item: Session } | { kind: 'intake'; item: Intake };

export function History() {
  const [days, setDays] = useState(30);
  const [editIntake, setEditIntake] = useState<Intake>();
  const from = startOfDay(addDays(new Date(), -(days - 1)));

  const data = useLive(async () => {
    const [sessions, intakes, oldest] = await Promise.all([
      db.sessions.where('takenAt').aboveOrEqual(from).toArray(),
      db.intakes.where('takenAt').aboveOrEqual(from).toArray(),
      db.sessions.orderBy('takenAt').first(),
    ]);
    return { sessions, intakes, hasOlder: !!oldest && oldest.takenAt < from };
  }, [days]);

  if (!data) return null;

  const entries: Entry[] = [
    ...data.sessions.map((item) => ({ kind: 'session' as const, item })),
    ...data.intakes.map((item) => ({ kind: 'intake' as const, item })),
  ].sort((a, b) => b.item.takenAt.getTime() - a.item.takenAt.getTime());

  const groups: { key: string; date: Date; entries: Entry[] }[] = [];
  for (const e of entries) {
    const key = dayKey(e.item.takenAt);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.entries.push(e);
    else groups.push({ key, date: e.item.takenAt, entries: [e] });
  }

  return (
    <>
      <header class="page-header">
        <h1>Verlauf</h1>
      </header>

      {groups.length === 0 && (
        <div class="empty">
          <p>In den letzten {days} Tagen wurden keine Werte erfasst.</p>
          <a class="btn primary" href="#/erfassen">
            Erste Messung erfassen
          </a>
        </div>
      )}

      {groups.map((g) => (
        <section class="day-group">
          <h2 class="day-title">{formatDayLong(g.date)}</h2>
          <ul class="entry-list">
            {g.entries.map((e) => (e.kind === 'session' ? <SessionItem s={e.item} /> : <IntakeItem i={e.item} onEdit={() => setEditIntake(e.item)} />))}
          </ul>
        </section>
      ))}

      {data.hasOlder && (
        <div class="center">
          <button type="button" class="btn" onClick={() => setDays((d) => d + 60)}>
            Ältere Einträge anzeigen
          </button>
        </div>
      )}

      {editIntake && <IntakeDialog intake={editIntake} onClose={() => setEditIntake(undefined)} />}
    </>
  );
}

function SessionItem({ s }: { s: Session }) {
  const a = sessionAverage(s);
  const c = classify(a.sys, a.dia);
  return (
    <li>
      <a class={`entry grade-bar-${c.grade}`} href={`#/erfassen/${s.id}`}>
        <span class="entry-time">{formatTime(s.takenAt)}</span>
        <span class="entry-main">
          <span class="entry-bp">
            {a.sys}/{a.dia}
            {a.pulse !== undefined && <span class="muted"> · {a.pulse} /min</span>}
          </span>
          <span class="entry-meta">
            {s.readings.length > 1 && <span class="pill-tag">Ø aus {s.readings.length}</span>}
            {s.arm === 'rechts' && <span class="pill-tag">rechts</span>}
            {s.tags?.map((t) => <span class="pill-tag">{t}</span>)}
            {s.note && <span class="note">{s.note}</span>}
          </span>
        </span>
        <span class={`dot grade-${c.grade}`} title={c.label} />
      </a>
    </li>
  );
}

function IntakeItem({ i, onEdit }: { i: Intake; onEdit: () => void }) {
  return (
    <li>
      <button type="button" class="entry entry-intake" onClick={onEdit}>
        <span class="entry-time">{formatTime(i.takenAt)}</span>
        <span class="entry-main">
          <span class="intake-label">
            <Icon name="pill" size={18} /> {i.drug} {i.doseMg} mg eingenommen
          </span>
        </span>
      </button>
    </li>
  );
}

function IntakeDialog({ intake, onClose }: { intake: Intake; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(toLocalInput(intake.takenAt));

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function save() {
    const d = fromLocalInput(value);
    if (!Number.isNaN(d.getTime())) await db.intakes.update(intake.id!, { takenAt: d });
    ref.current?.close();
  }

  async function remove() {
    if (!confirm('Diese Einnahme löschen?')) return;
    await db.intakes.delete(intake.id!);
    ref.current?.close();
  }

  return (
    <dialog ref={ref} class="dialog" onClose={onClose}>
      <h2>Einnahme bearbeiten</h2>
      <p class="muted">
        {intake.drug} {intake.doseMg} mg
      </p>
      <label class="field">
        <span>Zeitpunkt</span>
        <input type="datetime-local" value={value} onInput={(e) => setValue(e.currentTarget.value)} />
      </label>
      <div class="actions">
        <button type="button" class="btn danger" onClick={remove}>
          Löschen
        </button>
        <button type="button" class="btn" onClick={() => ref.current?.close()}>
          Abbrechen
        </button>
        <button type="button" class="btn primary grow" onClick={save}>
          Speichern
        </button>
      </div>
    </dialog>
  );
}
