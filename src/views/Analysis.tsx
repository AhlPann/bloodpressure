import { BpChart } from '../components/BpChart';
import { BpValue, Card, formatAvg, formatPercent, GradeBadge, RangePicker, useRange } from '../components/common';
import { DISCLAIMER, HOME_TARGET } from '../lib/classify';
import { adherence, compareIntakeDays, dayPart, summarize, summarizeByIntakeBucket, type DayPart, type Summary } from '../lib/stats';
import { useRangeData } from './useRangeData';

export function Analysis() {
  const r = useRange(30);
  const data = useRangeData(r.range);

  return (
    <>
      <header class="page-header">
        <h1>Auswertung</h1>
      </header>
      <RangePicker {...r} />
      {data && (data.sessions.length === 0 ? <EmptyRange /> : <Content {...data} from={r.range.from} to={r.range.to} />)}
    </>
  );
}

function EmptyRange() {
  return (
    <div class="empty">
      <p>Im gewählten Zeitraum gibt es keine Messungen.</p>
    </div>
  );
}

type Data = NonNullable<ReturnType<typeof useRangeData>> & { from: Date; to: Date };

function Content({ sessions, intakes, intakesAll, settings, from, to }: Data) {
  const total = summarize(sessions);
  const parts: DayPart[] = ['morgens', 'tagsüber', 'abends', 'nachts'];
  const byPart = parts
    .map((p) => ({ part: p, summary: summarize(sessions.filter((s) => dayPart(s.takenAt) === p)) }))
    .filter((x) => x.summary.count > 0);
  const buckets = summarizeByIntakeBucket(sessions, intakesAll);
  const days = compareIntakeDays(sessions, intakes);
  const adh = adherence(intakes, from, to);
  const drug = `${settings.drugName} ${settings.doseMg} mg`;

  return (
    <>
      <Card class="hero">
        <div class="muted">Durchschnitt</div>
        <BpValue avg={total.avg!} large />
        <GradeBadge sys={total.avg!.sys} dia={total.avg!.dia} />
        <p class="small muted">
          {total.count} Messsitzungen mit {total.readingCount} Einzelmessungen. Zielwert bei Selbstmessung: unter {HOME_TARGET.sys}/{HOME_TARGET.dia}.{' '}
          {formatPercent(total.aboveTargetShare)} der Sitzungen lagen darüber.
        </p>
      </Card>

      <Card title="Verlauf">
        <BpChart sessions={sessions} intakes={intakes} from={from} to={to} />
        <p class="small muted chart-legend">
          <span class="legend-intake">▲</span> Einnahme {settings.drugName} · gestrichelt: Zielwert {HOME_TARGET.sys}/{HOME_TARGET.dia} · Puls über die Legende einblendbar
        </p>
      </Card>

      <Card title="Nach Tageszeit">
        <div class="stat-grid">
          {byPart.map(({ part, summary }) => (
            <StatTile label={part[0].toUpperCase() + part.slice(1)} summary={summary} />
          ))}
        </div>
        <dl class="minmax">
          <div>
            <dt>Niedrigster Wert</dt>
            <dd>{formatAvg(total.min)}</dd>
          </div>
          <div>
            <dt>Höchster Wert</dt>
            <dd>{formatAvg(total.max)}</dd>
          </div>
        </dl>
      </Card>

      <Card title={`Bezug zur Einnahme (${drug})`}>
        <p class="small">
          Einnahme erfasst an <strong>{adh.taken}</strong> von {adh.days} Tagen.
        </p>
        {intakesAll.length === 0 ? (
          <p class="small muted">Erfassen Sie Ihre Einnahmen auf der Startseite, dann erscheint hier der Vergleich.</p>
        ) : (
          <>
            <table class="table">
              <thead>
                <tr>
                  <th>Zeit seit Einnahme</th>
                  <th class="num">Sitzungen</th>
                  <th class="num">Ø</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr>
                    <td>{b.bucket}</td>
                    <td class="num">{b.summary.count}</td>
                    <td class="num">{formatAvg(b.summary.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table class="table">
              <tbody>
                <tr>
                  <td>Tage mit Einnahme</td>
                  <td class="num">{days.withIntake.count}</td>
                  <td class="num">{formatAvg(days.withIntake.avg)}</td>
                </tr>
                <tr>
                  <td>Tage ohne erfasste Einnahme</td>
                  <td class="num">{days.withoutIntake.count}</td>
                  <td class="num">{formatAvg(days.withoutIntake.avg)}</td>
                </tr>
              </tbody>
            </table>
            <p class="small muted">Auffällige Unterschiede zwischen den Gruppen, etwa höhere Werte kurz vor der nächsten Einnahme, sind ein guter Gesprächspunkt für den Arzttermin.</p>
          </>
        )}
      </Card>

      <p class="disclaimer">{DISCLAIMER}</p>
    </>
  );
}

function StatTile({ label, summary }: { label: string; summary: Summary }) {
  return (
    <div class="stat">
      <div class="stat-label">{label}</div>
      <div class="stat-value">{formatAvg(summary.avg)}</div>
      <div class="stat-sub">
        {summary.count} × {summary.avg?.pulse !== undefined && `· Puls ${summary.avg.pulse}`}
      </div>
      {summary.avg && <GradeBadge sys={summary.avg.sys} dia={summary.avg.dia} />}
    </div>
  );
}
