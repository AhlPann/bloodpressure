import { Chart, Legend, LinearScale, LineController, LineElement, PointElement, TimeScale, Tooltip, type Plugin } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { de } from 'date-fns/locale';
import { useEffect, useRef, useState } from 'preact/hooks';
import { HOME_TARGET } from '../lib/classify';
import { sessionAverage } from '../lib/stats';
import type { Intake, Session } from '../lib/types';

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Legend);

interface Palette {
  sys: string;
  dia: string;
  pulse: string;
  intake: string;
  text: string;
  grid: string;
}

const PRINT_PALETTE: Palette = { sys: '#c62839', dia: '#2463b5', pulse: '#7a8391', intake: '#2f8f5b', text: '#333', grid: '#e3e3e3' };

function themePalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (n: string) => css.getPropertyValue(n).trim();
  return { sys: v('--sys'), dia: v('--dia'), pulse: v('--pulse'), intake: v('--intake'), text: v('--muted'), grid: v('--border') };
}

interface Props {
  sessions: Session[];
  intakes: Intake[];
  from: Date;
  to: Date;
  /** Für den Bericht: festes Format, helle Farben, als Bild gerendert (druckt zuverlässig). */
  print?: boolean;
}

export function BpChart({ sessions, intakes, from, to, print }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<string>();

  useEffect(() => {
    const p = print ? PRINT_PALETTE : themePalette();
    const points = [...sessions]
      .sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime())
      .map((s) => ({ x: s.takenAt.getTime(), a: sessionAverage(s) }));
    const dense = points.length > 60;
    const spanDays = (to.getTime() - from.getTime()) / 86_400_000;
    const unit = spanDays <= 2 ? 'hour' : spanDays <= 120 ? 'day' : 'month';

    const intakeMarkers: Plugin<'line'> = {
      id: 'intakeMarkers',
      afterDatasetsDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        ctx.save();
        ctx.fillStyle = p.intake;
        for (const i of intakes) {
          const px = scales.x.getPixelForValue(i.takenAt.getTime());
          if (px < chartArea.left || px > chartArea.right) continue;
          ctx.beginPath();
          ctx.moveTo(px, chartArea.bottom - 7);
          ctx.lineTo(px - 4, chartArea.bottom);
          ctx.lineTo(px + 4, chartArea.bottom);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      },
    };

    const line = (label: string, color: string, data: { x: number; y: number }[], extra: object = {}) => ({
      label,
      data,
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      pointRadius: dense ? 1.5 : 3,
      pointHoverRadius: 5,
      tension: 0.25,
      ...extra,
    });
    const target = (label: string, color: string, y: number) =>
      line(label, color, [{ x: from.getTime(), y }, { x: to.getTime(), y }], { borderWidth: 1, borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 0, tension: 0 });

    const chart = new Chart(canvas.current!, {
      type: 'line',
      data: {
        datasets: [
          line('Systolisch', p.sys, points.map((pt) => ({ x: pt.x, y: pt.a.sys }))),
          line('Diastolisch', p.dia, points.map((pt) => ({ x: pt.x, y: pt.a.dia }))),
          line('Puls', p.pulse, points.filter((pt) => pt.a.pulse !== undefined).map((pt) => ({ x: pt.x, y: pt.a.pulse! })), {
            hidden: !print,
            borderWidth: 1.5,
            borderDash: [2, 3],
          }),
          target('Ziel SYS', p.sys, HOME_TARGET.sys),
          target('Ziel DIA', p.dia, HOME_TARGET.dia),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: print ? false : { duration: 300 },
        devicePixelRatio: print ? 2 : undefined,
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        scales: {
          x: {
            type: 'time',
            min: from.getTime(),
            max: to.getTime(),
            adapters: { date: { locale: de } },
            time: {
              unit,
              tooltipFormat: 'EEE dd.MM.yyyy, HH:mm',
              displayFormats: { hour: 'HH:mm', day: 'dd.MM.', month: 'MMM yy' },
            },
            ticks: { color: p.text, maxRotation: 0, autoSkip: true, maxTicksLimit: print ? 12 : 6 },
            grid: { color: p.grid },
          },
          y: {
            suggestedMin: 60,
            suggestedMax: 160,
            title: { display: true, text: 'mmHg', color: p.text },
            ticks: { color: p.text },
            grid: { color: p.grid },
          },
        },
        plugins: {
          legend: {
            labels: { color: p.text, boxWidth: 14, boxHeight: 2, filter: (item) => !item.text.startsWith('Ziel') },
          },
          tooltip: { filter: (item) => !String(item.dataset.label).startsWith('Ziel') },
        },
      },
      plugins: [intakeMarkers],
    });

    if (print) setImage(chart.toBase64Image('image/png', 1));
    return () => chart.destroy();
  }, [sessions, intakes, from.getTime(), to.getTime(), print]);

  if (print) {
    return (
      <div class="chart-print">
        <div class="chart-offscreen" aria-hidden="true">
          <canvas ref={canvas} />
        </div>
        {image && <img src={image} alt="Verlaufsdiagramm der Blutdruckwerte" />}
      </div>
    );
  }
  return (
    <div class="chart-box">
      <canvas ref={canvas} role="img" aria-label="Verlaufsdiagramm der Blutdruckwerte" />
    </div>
  );
}
