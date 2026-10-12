"use client";

import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table2, LineChart as LineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Графіки аналітики. Правила: одна вісь Y на графік (різні одиниці — окремі графіки),
 * категоріальні кольори в фіксованому порядку, легенда для ≥2 серій, тонкі лінії (2px),
 * стовпці ≤ 24px з заокругленим кінцем, підказки при наведенні, табличне подання для кожного графіка.
 */

export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];

const axisProps = {
  stroke: "var(--viz-axis)",
  tick: { fill: "var(--viz-axis)", fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: "var(--viz-grid)" },
} as const;

export interface SeriesDef {
  key: string;
  label: string;
}

function compact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function TooltipBox({ title, rows }: { title: ReactNode; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-md border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-semibold">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2">
          {r.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span className="text-muted-foreground">{r.label}</span>
          <span className="num ml-auto pl-3 font-medium">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function ChartFrame({
  title,
  subtitle,
  children,
  table,
  legend,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  table: ReactNode;
  legend?: SeriesDef[];
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className={cn("rounded-lg border bg-card", className)}>
      <figcaption className="flex items-start justify-between gap-2 px-4 pt-3">
        <div>
          <p className="text-[13px] font-semibold">{title}</p>
          {subtitle && <p className="text-2xs text-muted-foreground">{subtitle}</p>}
        </div>
        <Button variant="ghost" size="xs" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} aria-label={asTable ? "Показати графік" : "Показати таблицею"}>
          {asTable ? <LineIcon /> : <Table2 />} {asTable ? "Графік" : "Таблиця"}
        </Button>
      </figcaption>
      {legend && legend.length >= 2 && !asTable && (
        <ul className="flex flex-wrap gap-3 px-4 pt-2 text-2xs text-muted-foreground" aria-label="Легенда">
          {legend.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3 rounded" style={{ background: SERIES[i % SERIES.length], height: 2 }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div className="p-2 pt-1">{asTable ? <div className="max-h-72 overflow-auto px-2 pb-2">{table}</div> : children}</div>
    </figure>
  );
}

export function SimpleTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <table className="data-table w-full text-xs">
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={c} scope="col" className={i > 0 ? "text-right" : undefined}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((v, j) => (
              <td key={j} className={cn(j > 0 && "num text-right")}>
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Лінійний графік однієї величини (або кількох серій в одних одиницях) по днях. */
export function TrendChart({
  title,
  subtitle,
  data,
  xKey,
  series,
  format,
  height = 220,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  data: Record<string, string | number | null>[];
  xKey: string;
  series: SeriesDef[];
  format: (v: number) => string;
  height?: number;
}) {
  const table = (
    <SimpleTable
      columns={["Дата", ...series.map((s) => s.label)]}
      rows={data.map((d) => [String(d[xKey]), ...series.map((s) => (d[s.key] === null || d[s.key] === undefined ? "—" : format(Number(d[s.key]))))])}
    />
  );
  return (
    <ChartFrame title={title} subtitle={subtitle} table={table} legend={series}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
          <XAxis dataKey={xKey} {...axisProps} minTickGap={16} />
          <YAxis {...axisProps} width={52} tickFormatter={(v: number) => compact(v)} />
          <Tooltip
            cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={label}
                  rows={payload.map((p, i) => ({ label: String(series.find((s) => s.key === p.dataKey)?.label ?? p.name), value: p.value === null || p.value === undefined ? "—" : format(Number(p.value)), color: SERIES[i % SERIES.length] }))}
                />
              ) : null
            }
          />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={SERIES[i % SERIES.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Горизонтальні стовпці для порівняння категорій (креативи, плейсменти) за однією метрикою. */
export function BarCompare({
  title,
  subtitle,
  data,
  format,
  highlightKey,
  extraColumns,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  data: { name: string; value: number | null; key?: string; extra?: (string | number)[] }[];
  format: (v: number) => string;
  highlightKey?: string;
  extraColumns?: string[];
}) {
  const clean = data.filter((d) => d.value !== null) as { name: string; value: number; key?: string; extra?: (string | number)[] }[];
  const height = Math.max(120, clean.length * 34 + 30);
  const table = (
    <SimpleTable
      columns={["Назва", "Значення", ...(extraColumns ?? [])]}
      rows={data.map((d) => [d.name, d.value === null ? "—" : format(d.value), ...(d.extra ?? [])])}
    />
  );
  return (
    <ChartFrame title={title} subtitle={subtitle} table={table}>
      {clean.length === 0 ? (
        <p className="px-3 py-8 text-center text-xs text-muted-foreground">Немає даних для порівняння.</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={clean} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }} barCategoryGap={8}>
            <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
            <XAxis type="number" {...axisProps} tickFormatter={(v: number) => compact(v)} />
            <YAxis type="category" dataKey="name" {...axisProps} width={150} tick={{ fill: "var(--viz-axis)", fontSize: 11 }} interval={0} />
            <Tooltip
              cursor={{ fill: "var(--viz-grid)", opacity: 0.5 }}
              content={({ active, payload }) =>
                active && payload?.length ? <TooltipBox title={String(payload[0].payload.name)} rows={[{ label: "Значення", value: format(Number(payload[0].value)) }]} /> : null
              }
            />
            <Bar dataKey="value" maxBarSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false} label={{ position: "right", fill: "var(--viz-axis)", fontSize: 11, formatter: (v: unknown) => format(Number(v)) }}>
              {clean.map((d) => (
                <Cell key={d.name} fill={highlightKey && d.key === highlightKey ? "var(--series-2)" : "var(--series-1)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}

/** Воронка як упорядковані горизонтальні смуги (ordinal blue). */
export function Funnel({ steps, title, subtitle }: { title: ReactNode; subtitle?: ReactNode; steps: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  const shades = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"];
  const table = (
    <SimpleTable
      columns={["Етап", "Кількість", "Конверсія з попереднього"]}
      rows={steps.map((s, i) => [s.label, Math.round(s.value).toLocaleString("uk-UA"), i === 0 ? "—" : steps[i - 1].value > 0 ? `${((s.value / steps[i - 1].value) * 100).toFixed(1)}%` : "—"])}
    />
  );
  return (
    <ChartFrame title={title} subtitle={subtitle} table={table}>
      <ol className="grid gap-2 px-2 py-2">
        {steps.map((s, i) => {
          const rate = i > 0 && steps[i - 1].value > 0 ? (s.value / steps[i - 1].value) * 100 : null;
          return (
            <li key={s.label} className="grid grid-cols-[120px_1fr] items-center gap-2 text-xs sm:grid-cols-[150px_1fr]">
              <span className="truncate text-muted-foreground" title={s.label}>
                {s.label}
              </span>
              <div className="flex items-center gap-2">
                <div className="h-5 rounded-r" style={{ width: `${Math.max(1.5, (s.value / max) * 100)}%`, background: shades[Math.min(i, shades.length - 1)] }} />
                <span className="num whitespace-nowrap font-medium">{Math.round(s.value).toLocaleString("uk-UA")}</span>
                {rate !== null && <span className="num whitespace-nowrap text-2xs text-muted-foreground">({rate.toFixed(1)}%)</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </ChartFrame>
  );
}
