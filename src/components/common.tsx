import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { classify } from '../lib/classify';
import { addDays, dayKey, endOfDay, fromDayKey, startOfDay } from '../lib/dates';
import type { Avg } from '../lib/stats';

const ICONS = {
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  chart: <path d="M4 4v16h16M7.5 15l3.5-4.5 3 3L19 7" />,
  doc: <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />,
  settings: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  pill: <><path d="M10.6 3.9a4.95 4.95 0 0 1 7 7l-6.7 6.7a4.95 4.95 0 0 1-7-7z" /><path d="M7.25 7.25l7 7" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  print: <path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" />,
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export function GradeBadge({ sys, dia }: { sys: number; dia: number }) {
  const c = classify(sys, dia);
  return <span class={`badge grade-${c.grade}`}>{c.label}</span>;
}

export function BpValue({ avg, large }: { avg: Avg; large?: boolean }) {
  return (
    <span class={large ? 'bp bp-large' : 'bp'}>
      {avg.sys}/{avg.dia}
      <small> mmHg</small>
      {avg.pulse !== undefined && <span class="pulse"> · Puls {avg.pulse}</span>}
    </span>
  );
}

export function Card({ title, children, class: cls }: { title?: ComponentChildren; children: ComponentChildren; class?: string }) {
  return (
    <section class={`card ${cls ?? ''}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

export const formatAvg = (a?: Avg) => (a ? `${a.sys}/${a.dia}` : '–');
export const formatPercent = (x: number) => `${Math.round(x * 100)} %`;

/* ---------- Zeitraum-Auswahl ---------- */

export type RangePreset = 7 | 30 | 90 | 365 | 'custom';

export interface Range {
  from: Date;
  to: Date;
}

export function useRange(initial: RangePreset = 30) {
  const [preset, setPreset] = useState<RangePreset>(initial);
  const [customFrom, setCustomFrom] = useState(dayKey(addDays(new Date(), -29)));
  const [customTo, setCustomTo] = useState(dayKey(new Date()));
  const range = useMemo<Range>(() => {
    if (preset === 'custom') {
      const a = startOfDay(fromDayKey(customFrom));
      const b = endOfDay(fromDayKey(customTo));
      return a <= b ? { from: a, to: b } : { from: startOfDay(b), to: endOfDay(a) };
    }
    return { from: startOfDay(addDays(new Date(), -(preset - 1))), to: endOfDay(new Date()) };
  }, [preset, customFrom, customTo]);
  return { preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, range };
}

export function RangePicker(props: ReturnType<typeof useRange>) {
  const presets: [RangePreset, string][] = [[7, '7 Tage'], [30, '30 Tage'], [90, '90 Tage'], [365, '1 Jahr'], ['custom', 'Frei']];
  return (
    <div class="range-picker no-print">
      <div class="chips" role="radiogroup" aria-label="Zeitraum">
        {presets.map(([p, label]) => (
          <button type="button" role="radio" aria-checked={props.preset === p} class={props.preset === p ? 'chip active' : 'chip'} onClick={() => props.setPreset(p)}>
            {label}
          </button>
        ))}
      </div>
      {props.preset === 'custom' && (
        <div class="custom-range">
          <label>
            Von
            <input type="date" value={props.customFrom} onInput={(e) => props.setCustomFrom(e.currentTarget.value)} />
          </label>
          <label>
            Bis
            <input type="date" value={props.customTo} onInput={(e) => props.setCustomTo(e.currentTarget.value)} />
          </label>
        </div>
      )}
    </div>
  );
}
