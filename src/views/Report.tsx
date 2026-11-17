import { BpChart } from '../components/BpChart';
import { formatAvg, formatPercent, Icon, RangePicker, useRange } from '../components/common';
import { classify, DISCLAIMER, HOME_TARGET } from '../lib/classify';
import { formatDate, formatDateTime, formatTime } from '../lib/dates';
import { adherence, dayPart, hoursSinceLastIntake, sessionAverage, summarize, type Summary } from '../lib/stats';
import { useRangeData } from './useRangeData';

export function Report() {
  const r = useRange(30);
  const data = useRangeData(r.range);
  const { from, to } = r.range;

  return (
    <>
      <header class="page-header no-print">
        <h1>Bericht für den Arzt</h1>
      </header>
      <RangePicker {...r} />
      <div class="no-print report-actions">
        <button type="button" class="btn primary" onClick={() => window.print()} disabled={!data?.sessions.length}>
          <Icon name="print" size={20} /> Drucken / als PDF speichern
        </button>
        <p class="small muted">Im Druckdialog „Als PDF speichern“ wählen, um den Bericht zu teilen.</p>
      </div>

      {data && data.sessions.length === 0 && (
        <div class="empty no-print">
          <p>Im gewählten Zeitraum gibt es keine Messungen.</p>
        </div>
      )}

      {data && data.sessions.length > 0 && (
        <article class="report">
          <h1>Blutdruck-Protokoll</h1>
          <dl class="report-meta">
            {data.settings.patientName && (
              <div>
                <dt>Name</dt>
                <dd>{data.settings.patientName}</dd>
              </div>
            )}
            <div>
              <dt>Zeitraum</dt>
              <dd>
                {formatDate(from)} – {formatDate(to)}
              </dd>
            </div>
            <div>
              <dt>Medikation</dt>
              <dd>
                {data.settings.drugName} {data.settings.doseMg} mg, 1× täglich (übliche Einnahme {data.settings.usualIntakeTime} Uhr)
              </dd>
            </div>
            <div>
              <dt>Einnahme erfasst</dt>
              <dd>
                {(() => {
                  const a = adherence(data.intakes, from, to);
                  return `an ${a.taken} von ${a.days} Tagen`;
                })()}
              </dd>
            </div>
            <div>
              <dt>Erstellt</dt>
              <dd>{formatDateTime(new Date())}</dd>
            </div>
          </dl>

          <h2>Zusammenfassung</h2>
          <table class="table report-summary">
            <thead>
              <tr>
                <th />
                <th class="num">Sitzungen</th>
                <th class="num">Ø SYS/DIA</th>
                <th class="num">Ø Puls</th>
                <th class="num">Min</th>
                <th class="num">Max</th>
                <th class="num">≥ {HOME_TARGET.sys}/{HOME_TARGET.dia}</th>
                <th>Einstufung Ø</th>
              </tr>
            </thead>
            <tbody>
              <SummaryRow label="Gesamt" s={summarize(data.sessions)} strong />
              {(['morgens', 'tagsüber', 'abends', 'nachts'] as const).map((p) => {
                const s = summarize(data.sessions.filter((x) => dayPart(x.takenAt) === p));
                return s.count > 0 && <SummaryRow label={p[0].toUpperCase() + p.slice(1)} s={s} />;
              })}
            </tbody>
          </table>

          <h2>Verlauf</h2>
          <BpChart sessions={data.sessions} intakes={data.intakes} from={from} to={to} print />
          <p class="small muted">▲ = Einnahme {data.settings.drugName} · gestrichelt: Schwellenwert Selbstmessung {HOME_TARGET.sys}/{HOME_TARGET.dia} mmHg</p>

          <h2>Einzelwerte</h2>
          <table class="table report-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Uhrzeit</th>
                <th class="num">SYS</th>
                <th class="num">DIA</th>
                <th class="num">Puls</th>
                <th class="num">Mess.</th>
                <th class="num">Std. seit Einnahme</th>
                <th>Bemerkung</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((s) => {
                const a = sessionAverage(s);
                const h = hoursSinceLastIntake(s.takenAt, data.intakesAll);
                const high = a.sys >= HOME_TARGET.sys || a.dia >= HOME_TARGET.dia;
                return (
                  <tr class={high ? 'high' : ''}>
                    <td>{formatDate(s.takenAt)}</td>
                    <td>{formatTime(s.takenAt)}</td>
                    <td class="num">{a.sys}</td>
                    <td class="num">{a.dia}</td>
                    <td class="num">{a.pulse ?? ''}</td>
                    <td class="num">{s.readings.length}</td>
                    <td class="num">{h === undefined ? '' : h.toFixed(1).replace('.', ',')}</td>
                    <td>{[s.arm === 'rechts' ? 'rechter Arm' : '', ...(s.tags ?? []), s.note ?? ''].filter(Boolean).join(', ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p class="small muted report-foot">
            Selbstmessung am Oberarm. Pro Sitzung wurden bis zu drei Messungen kurz hintereinander durchgeführt; angegeben ist jeweils der Mittelwert.
            Fett markierte Zeilen liegen auf oder über dem Schwellenwert {HOME_TARGET.sys}/{HOME_TARGET.dia} mmHg. Einstufung nach ESH-Leitlinie 2023. {DISCLAIMER}
          </p>
        </article>
      )}
    </>
  );
}

function SummaryRow({ label, s, strong }: { label: string; s: Summary; strong?: boolean }) {
  return (
    <tr class={strong ? 'strong' : ''}>
      <td>{label}</td>
      <td class="num">{s.count}</td>
      <td class="num">{formatAvg(s.avg)}</td>
      <td class="num">{s.avg?.pulse ?? '–'}</td>
      <td class="num">{formatAvg(s.min)}</td>
      <td class="num">{formatAvg(s.max)}</td>
      <td class="num">{formatPercent(s.aboveTargetShare)}</td>
      <td>{s.avg ? classify(s.avg.sys, s.avg.dia).label : '–'}</td>
    </tr>
  );
}
