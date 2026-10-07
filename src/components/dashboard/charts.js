"use client";

/**
 * Dependency-free SVG charts for the admin and seller dashboards.
 *
 * The README lists "Charts: Sales, revenue, orders, users, products" as an admin
 * feature, but no chart component or chart library existed. Rather than add a
 * charting dependency (which would bloat the client bundle and pull in
 * TypeScript typings), these are small hand-rolled SVG components that render
 * the series the /api/admin/stats and /api/seller/stats endpoints already
 * return. They are responsive via viewBox and include accessible text fallbacks.
 */
import { useId } from "react";
import { formatCurrency } from "@/utils/format";

const PALETTE = ["#15803d", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#64748b"];

function useTicks(max, count = 4) {
  if (!max || max <= 0) return [0, 1];
  const step = max / count;
  return Array.from({ length: count + 1 }, (_, index) => Math.round(step * index * 100) / 100);
}

/**
 * Area/line chart for time series (revenue, orders, users per month).
 * @param {{labels:string[], values:number[]}} series
 */
export function LineChart({ series, height = 200, format = "number", color = PALETTE[0], title }) {
  const gradientId = useId();
  const labels = series?.labels || [];
  const values = (series?.values || []).map((value) => Number(value) || 0);

  if (!labels.length || !values.length) {
    return <ChartEmpty title={title} message="No data available for this period yet." />;
  }

  const width = 640;
  const padLeft = 52;
  const padRight = 12;
  const padTop = 14;
  const padBottom = 28;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const max = Math.max(...values, 0);
  const niceMax = max === 0 ? 1 : max * 1.15;
  const ticks = useTicks(niceMax);

  const xAt = (index) => padLeft + (values.length === 1 ? innerW / 2 : (innerW * index) / (values.length - 1));
  const yAt = (value) => padTop + innerH - (value / niceMax) * innerH;

  const points = values.map((value, index) => `${xAt(index).toFixed(2)},${yAt(value).toFixed(2)}`).join(" ");
  const areaPath = `M ${xAt(0).toFixed(2)},${(padTop + innerH).toFixed(2)} L ${points.split(" ").join(" L ")} L ${xAt(values.length - 1).toFixed(2)},${(padTop + innerH).toFixed(2)} Z`;

  const formatValue = (value) => (format === "currency" ? formatCurrency(value) : String(Math.round(value)));

  return (
    <figure className="card p-4">
      {title && <figcaption className="mb-3 text-sm font-semibold text-gray-900">{title}</figcaption>}
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={title || "Line chart"}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={padLeft} y1={yAt(tick)} x2={width - padRight} y2={yAt(tick)} stroke="#e5e7eb" strokeWidth="1" />
            <text x={padLeft - 8} y={yAt(tick) + 4} textAnchor="end" fontSize="10" fill="#6b7280">
              {format === "currency" ? Math.round(tick) : tick}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {values.map((value, index) => (
          <circle key={index} cx={xAt(index)} cy={yAt(value)} r="3" fill="#fff" stroke={color} strokeWidth="2">
            <title>{`${labels[index]}: ${formatValue(value)}`}</title>
          </circle>
        ))}

        {labels.map((label, index) => {
          // Thin out x labels when there are many, so they never overlap.
          const step = Math.ceil(labels.length / 12);
          if (index % step !== 0 && index !== labels.length - 1) return null;
          return (
            <text key={label + index} x={xAt(index)} y={height - 8} textAnchor="middle" fontSize="10" fill="#6b7280">
              {label}
            </text>
          );
        })}
      </svg>

      <figcaption className="sr-only">
        {labels.map((label, index) => `${label}: ${formatValue(values[index])}`).join(", ")}
      </figcaption>
    </figure>
  );
}

/** Vertical bar chart (products per category, best sellers, etc.). */
export function BarChart({ series, height = 220, format = "number", title, horizontal = false }) {
  const labels = series?.labels || [];
  const values = (series?.values || []).map((value) => Number(value) || 0);

  if (!labels.length || !values.length) {
    return <ChartEmpty title={title} message="No data available yet." />;
  }

  const formatValue = (value) => (format === "currency" ? formatCurrency(value) : String(Math.round(value * 100) / 100));
  const max = Math.max(...values, 1);

  if (horizontal) {
    return (
      <figure className="card p-4">
        {title && <figcaption className="mb-3 text-sm font-semibold text-gray-900">{title}</figcaption>}
        <ul className="space-y-3">
          {labels.map((label, index) => (
            <li key={`${label}-${index}`}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-gray-700">{label}</span>
                <span className="shrink-0 font-medium text-gray-900">{formatValue(values[index])}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, (values[index] / max) * 100)}%`,
                    backgroundColor: PALETTE[index % PALETTE.length],
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </figure>
    );
  }

  const width = 640;
  const padLeft = 40;
  const padRight = 12;
  const padTop = 14;
  const padBottom = 42;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const slot = innerW / labels.length;
  const barWidth = Math.min(46, slot * 0.62);
  const ticks = useTicks(max * 1.1);
  const niceMax = max * 1.1;

  return (
    <figure className="card p-4">
      {title && <figcaption className="mb-3 text-sm font-semibold text-gray-900">{title}</figcaption>}
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={title || "Bar chart"}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={padLeft} y1={padTop + innerH - (tick / niceMax) * innerH} x2={width - padRight} y2={padTop + innerH - (tick / niceMax) * innerH} stroke="#e5e7eb" />
            <text x={padLeft - 6} y={padTop + innerH - (tick / niceMax) * innerH + 4} textAnchor="end" fontSize="10" fill="#6b7280">
              {Math.round(tick)}
            </text>
          </g>
        ))}

        {values.map((value, index) => {
          const barHeight = (value / niceMax) * innerH;
          const x = padLeft + slot * index + (slot - barWidth) / 2;
          const y = padTop + innerH - barHeight;
          return (
            <g key={`${labels[index]}-${index}`}>
              <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, value > 0 ? 2 : 0)} rx="3" fill={PALETTE[index % PALETTE.length]}>
                <title>{`${labels[index]}: ${formatValue(value)}`}</title>
              </rect>
              <text x={x + barWidth / 2} y={height - padBottom + 16} textAnchor="middle" fontSize="10" fill="#6b7280">
                {labels[index].length > 10 ? `${labels[index].slice(0, 9)}…` : labels[index]}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Donut chart for order status distribution. */
export function DonutChart({ data, title, size = 200 }) {
  const rows = (data || []).filter((row) => Number(row.count) > 0);
  const total = rows.reduce((sum, row) => sum + Number(row.count), 0);

  if (!rows.length || total === 0) {
    return <ChartEmpty title={title} message="No orders yet." />;
  }

  const radius = 70;
  const stroke = 26;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <figure className="card p-4">
      {title && <figcaption className="mb-3 text-sm font-semibold text-gray-900">{title}</figcaption>}
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={title || "Donut chart"} className="shrink-0">
          <circle cx="100" cy="100" r={radius} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
          {rows.map((row, index) => {
            const fraction = Number(row.count) / total;
            const dash = fraction * circumference;
            const circle = (
              <circle
                key={row.status || row.label || index}
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={row.color || PALETTE[index % PALETTE.length]}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 100 100)"
              >
                <title>{`${row.status || row.label}: ${row.count}`}</title>
              </circle>
            );
            offset += dash;
            return circle;
          })}
          <text x="100" y="96" textAnchor="middle" fontSize="26" fontWeight="700" fill="#111827">
            {total}
          </text>
          <text x="100" y="116" textAnchor="middle" fontSize="11" fill="#6b7280">
            total
          </text>
        </svg>

        <ul className="w-full space-y-1.5 text-sm">
          {rows.map((row, index) => (
            <li key={row.status || row.label || index} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color || PALETTE[index % PALETTE.length] }} />
                <span className="truncate text-gray-700">{row.label || row.status}</span>
              </span>
              <span className="shrink-0 font-medium text-gray-900">
                {row.count}
                <span className="ml-1 text-xs text-gray-500">({Math.round((Number(row.count) / total) * 100)}%)</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

export function ChartEmpty({ title, message }) {
  return (
    <figure className="card flex min-h-40 flex-col items-center justify-center p-6 text-center">
      {title && <figcaption className="mb-2 text-sm font-semibold text-gray-900">{title}</figcaption>}
      <svg className="mb-2 h-8 w-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M4 20V10m5 10V4m5 16v-7m5 7V8" strokeLinecap="round" />
      </svg>
      <p className="text-xs text-gray-500">{message}</p>
    </figure>
  );
}

export { PALETTE };
