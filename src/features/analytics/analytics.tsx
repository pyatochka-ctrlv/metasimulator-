"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Lightbulb } from "lucide-react";
import { useActiveAccount, useAppStore } from "@/store/app-store";
import { objectiveLabel, placementById } from "@/domain/catalog";
import type { AdAccount, DailyMetrics, PlacementId } from "@/domain/types";
import { aggregate, ATTRIBUTION_PRESETS, rangeDays, type RangeKey, type ReportedMetrics } from "@/simulation/reporting";
import { diagnose, type Finding } from "@/simulation/diagnostics";
import { breakEvenRoas, twoProportionZTest, wilsonInterval } from "@/simulation/metrics";
import { estimateAudience } from "@/simulation/audience";
import { fmtShortSimDate, fmtSimDate } from "@/lib/dates";
import { fmtCompact, fmtInt, fmtMoney, fmtNum, fmtPct, fmtRoas } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArticleLink, EmptyState, MetricLabel, PageHeader, Section, SimulatedNotice, StatTile } from "@/components/common";
import { getMission } from "@/content/missions";
import { RANGE_LABELS } from "@/features/ads-manager/use-reports";
import { BarCompare, Funnel, TrendChart } from "./charts";

function daily(account: AdAccount, rows: DailyMetrics[]) {
  const days = Array.from(new Set(rows.map((r) => r.day))).sort((a, b) => a - b);
  return days.map((d) => ({ day: d, m: aggregate(account, rows.filter((r) => r.day === d)) }));
}

function FindingCard({ f }: { f: Finding }) {
  const tone = f.severity === "high" ? "destructive" : f.severity === "medium" ? "warning" : "secondary";
  return (
    <article className="rounded-lg border bg-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <AlertTriangle className={cn("h-4 w-4", f.severity === "high" ? "text-destructive" : "text-warning")} />
        <h3 className="text-[13px] font-semibold">{f.title}</h3>
        <Badge variant={tone}>{f.severity === "high" ? "високий вплив" : f.severity === "medium" ? "середній вплив" : "низький вплив"}</Badge>
        <Badge variant="outline">впевненість: {f.confidence}</Badge>
      </header>
      <p className="mt-1 text-2xs text-muted-foreground">{f.confidenceReason}</p>
      <div className="mt-3 grid gap-3 text-xs md:grid-cols-3">
        <div>
          <p className="mb-1 font-semibold">Докази</p>
          <ul className="space-y-0.5">
            {f.evidence.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 font-semibold">Альтернативні пояснення</p>
          <ul className="space-y-0.5 text-muted-foreground">
            {f.alternatives.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 flex items-center gap-1 font-semibold">
            <Lightbulb className="h-3.5 w-3.5 text-primary" /> Наступний тест
          </p>
          <p>{f.nextTest}</p>
          <p className="mt-1">
            <ArticleLink slug={f.articleSlug} />
          </p>
        </div>
      </div>
    </article>
  );
}

function SortableTable({ columns, rows, initialSort }: { columns: { id: string; label: string; metricId?: string; right?: boolean }[]; rows: { key: string; cells: Record<string, { v: number | string | null; d: React.ReactNode }> }[]; initialSort?: string }) {
  const [sort, setSort] = useState<{ id: string; dir: 1 | -1 }>({ id: initialSort ?? columns[1]?.id ?? columns[0].id, dir: -1 });
  const sorted = [...rows].sort((a, b) => {
    const va = a.cells[sort.id]?.v;
    const vb = b.cells[sort.id]?.v;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    return (typeof va === "string" ? va.localeCompare(String(vb)) : (va as number) - (vb as number)) * sort.dir;
  });
  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full text-xs">
        <thead>
          <tr>
            {columns.map((c) => (
              <th scope="col" key={c.id} className={c.right ? "text-right" : undefined}>
                <button type="button" onClick={() => setSort({ id: c.id, dir: sort.id === c.id ? ((-sort.dir) as 1 | -1) : -1 })}>
                  {c.metricId ? <MetricLabel id={c.metricId}>{c.label}</MetricLabel> : c.label}
                  {sort.id === c.id ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.key}>
              {columns.map((c) => (
                <td key={c.id} className={cn(c.right && "num text-right")}>
                  {r.cells[c.id]?.d ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignPicker({ account, value, onChange }: { account: AdAccount; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Кампанії: {value.length ? `${value.length} вибрано` : "усі"} <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2">
        <button type="button" className="mb-1 w-full rounded px-2 py-1 text-left text-xs text-primary hover:bg-muted" onClick={() => onChange([])}>
          Показати всі
        </button>
        {account.campaigns.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-muted">
            <Checkbox checked={value.includes(c.id)} onCheckedChange={(v) => onChange(v ? [...value, c.id] : value.filter((x) => x !== c.id))} className="mt-0.5" />
            <span>
              {c.name}
              <span className="block text-2xs text-muted-foreground">{objectiveLabel(c.objective)}</span>
            </span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function Analytics() {
  const account = useActiveAccount();
  const prefs = useAppStore((s) => s.prefs);
  const setPrefs = useAppStore((s) => s.setPrefs);
  const attempts = useAppStore((s) => s.missionAttempts);
  const [campaignIds, setCampaignIds] = useState<string[]>([]);
  const range = prefs.dateRange;

  const rows = useMemo(() => {
    if (!account) return [];
    const [from, to] = rangeDays(account, range);
    return account.metrics.filter((r) => r.day >= from && r.day <= to && (!campaignIds.length || campaignIds.includes(r.campaignId)));
  }, [account, range, campaignIds]);
  const total = useMemo(() => (account ? aggregate(account, rows) : null), [account, rows]);
  const series = useMemo(() => (account ? daily(account, rows) : []), [account, rows]);
  const findings = useMemo(() => (account ? diagnose(account, rows) : []), [account, rows]);

  if (!account || !total) return null;
  const hasData = rows.length > 0;
  const isSales = total.purchases > 0 || total.truePurchases > 0;
  const chartData = series.map(({ day, m }) => ({
    date: fmtShortSimDate(account.startDate, day),
    spend: Math.round(m.spend * 100) / 100,
    results: m.results,
    cpr: m.costPerResult,
    ctr: m.ctrLink,
    cpm: m.cpm,
    leads: m.leads,
    crm: m.crmLeads,
    purchases: m.purchases,
    backend: m.truePurchases,
  }));
  const missionAttempt = account.kind === "mission" ? Object.values(attempts).find((a) => a.accountId === account.id) : undefined;
  const mission = missionAttempt ? getMission(missionAttempt.missionId) : undefined;

  // Креативи
  const adsStats = account.ads
    .map((ad) => ({ ad, m: aggregate(account, rows.filter((r) => r.adId === ad.id)) }))
    .filter((x) => x.m.impressions > 0);
  const bestCtr = [...adsStats].sort((a, b) => (b.m.ctrLink ?? 0) - (a.m.ctrLink ?? 0))[0];

  // Плейсменти
  const placementTotals = new Map<PlacementId, { impressions: number; spend: number; linkClicks: number; lpv: number; conversions: number }>();
  for (const r of rows)
    for (const [pid, s] of Object.entries(r.byPlacement) as [PlacementId, { impressions: number; spend: number; linkClicks: number; lpv: number; conversions: number }][]) {
      const t = placementTotals.get(pid) ?? { impressions: 0, spend: 0, linkClicks: 0, lpv: 0, conversions: 0 };
      t.impressions += s.impressions;
      t.spend += s.spend;
      t.linkClicks += s.linkClicks;
      t.lpv += s.lpv;
      t.conversions += s.conversions;
      placementTotals.set(pid, t);
    }

  const planned = (() => {
    let p = 0;
    const [from, to] = rangeDays(account, range);
    for (let d = from; d <= to; d++) {
      for (const c of account.campaigns.filter((x) => !campaignIds.length || campaignIds.includes(x.id))) {
        if (c.status === "draft") continue;
        if (!rows.some((r) => r.campaignId === c.id && r.day === d)) continue;
        if (c.budgetLevel === "campaign") p += c.budgetType === "daily" ? c.budgetAmount : 0;
        else for (const s of account.adSets.filter((x) => x.campaignId === c.id && rows.some((r) => r.adSetId === x.id && r.day === d))) p += s.budgetType === "daily" ? s.budgetAmount : 0;
      }
    }
    return p;
  })();

  const beRoas = breakEvenRoas(account.economics.margin);
  const revenueBackend = total.trueRevenue + total.revenueFromLeads;
  const profit = revenueBackend * account.economics.margin - total.spend;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Analytics"
        description={`${account.name} · ${RANGE_LABELS[range]}${campaignIds.length ? ` · ${campaignIds.length} кампан.` : ""}`}
        actions={
          <>
            <CampaignPicker account={account} value={campaignIds} onChange={setCampaignIds} />
            <Select value={range} onValueChange={(v) => setPrefs({ dateRange: v as RangeKey })}>
              <SelectTrigger className="h-8 w-40" aria-label="Період">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RANGE_LABELS) as RangeKey[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {RANGE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      <div className="grid gap-4 p-4 sm:p-6">
        <SimulatedNotice />
        {!hasData ? (
          <EmptyState
            title="Немає даних за обраний період"
            description="Опублікуйте кампанію в Ads Manager і запустіть симуляцію днів — тут з'являться графіки, розбивки та діагностика."
            action={
              <Button asChild>
                <Link href="/ads-manager">До Ads Manager</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
              <StatTile label="Amount spent" metricId="spend" value={fmtMoney(total.spend)} />
              <StatTile label="Impressions" metricId="impressions" value={fmtCompact(total.impressions)} />
              <StatTile label="Reach" metricId="reach" value={fmtCompact(total.reach)} sub={`Frequency ${fmtNum(total.frequency)}`} />
              <StatTile label="CTR (link)" metricId="ctrLink" value={fmtPct(total.ctrLink)} />
              <StatTile label="CPC (link)" metricId="cpcLink" value={fmtMoney(total.cpcLink)} />
              <StatTile label="CPM" metricId="cpm" value={fmtMoney(total.cpm)} />
              {isSales ? (
                <>
                  <StatTile label="Purchases" metricId="purchases" value={fmtInt(total.purchases)} sub={`CPA ${fmtMoney(total.cpa)}`} />
                  <StatTile label="ROAS" metricId="roas" value={fmtRoas(total.roas)} sub={`Беззбитковий ${fmtRoas(beRoas)}`} tone={total.roas !== null && beRoas !== null ? (total.roas >= beRoas ? "good" : "bad") : undefined} />
                </>
              ) : (
                <>
                  <StatTile label="Leads" metricId="leads" value={fmtInt(total.leads)} sub={`CPL ${fmtMoney(total.cpl)}`} />
                  <StatTile label="Кваліф. ліди" metricId="qualifiedLeads" value={fmtInt(total.qualifiedLeads)} sub={`${fmtPct(total.qualifiedRate, 0)} · ${fmtMoney(total.costPerQualifiedLead)}`} />
                </>
              )}
            </div>
            {total.incomplete && <p className="text-2xs text-muted-foreground">* Конверсії останніх днів ще надходять (затримка між кліком і конверсією) — значення можуть зрости.</p>}

            <Tabs defaultValue="overview">
              <TabsList className="flex w-full flex-wrap justify-start">
                <TabsTrigger value="overview">Огляд</TabsTrigger>
                <TabsTrigger value="campaigns">Кампанії</TabsTrigger>
                <TabsTrigger value="creatives">Креативи</TabsTrigger>
                <TabsTrigger value="placements">Плейсменти</TabsTrigger>
                <TabsTrigger value="audiences">Аудиторії</TabsTrigger>
                <TabsTrigger value="days">По днях</TabsTrigger>
                <TabsTrigger value="funnel">Воронка</TabsTrigger>
                <TabsTrigger value="plan">План / факт</TabsTrigger>
                <TabsTrigger value="crm">Meta vs CRM</TabsTrigger>
                <TabsTrigger value="finance">Фінанси</TabsTrigger>
                <TabsTrigger value="attribution">Атрибуція</TabsTrigger>
                <TabsTrigger value="diagnostics">
                  Діагностика {findings.length > 0 && <Badge variant="warning">{findings.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="grid gap-4 pt-4 lg:grid-cols-2">
                <TrendChart title="Витрати по днях" subtitle="Amount spent, USD" data={chartData} xKey="date" series={[{ key: "spend", label: "Spend" }]} format={(v) => fmtMoney(v)} />
                <TrendChart title="Results по днях" subtitle={total.resultLabel} data={chartData} xKey="date" series={[{ key: "results", label: "Results" }]} format={(v) => fmtNum(v, 0)} />
                <TrendChart title="Cost per result" subtitle="Окремий графік — одна вісь, одна одиниця" data={chartData} xKey="date" series={[{ key: "cpr", label: "Cost per result" }]} format={(v) => fmtMoney(v)} />
                <TrendChart title="CTR (link), %" data={chartData} xKey="date" series={[{ key: "ctr", label: "CTR" }]} format={(v) => `${fmtNum(v)}%`} />
                {findings.length > 0 && (
                  <div className="lg:col-span-2">
                    <Section title="Головні сигнали діагностики" description="Повний розбір — на вкладці «Діагностика».">
                      <ul className="grid gap-1.5 text-xs">
                        {findings.slice(0, 3).map((f) => (
                          <li key={f.id} className="flex items-center gap-2">
                            <AlertTriangle className={cn("h-3.5 w-3.5", f.severity === "high" ? "text-destructive" : "text-warning")} />
                            <span className="font-medium">{f.title}</span>
                            <span className="text-muted-foreground">— {f.evidence[0]}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="campaigns" className="pt-4">
                <Section title="Таблиця кампаній" description="Сортування — клік по заголовку. Деталізація — в Ads Manager.">
                  <SortableTable
                    initialSort="spend"
                    columns={[
                      { id: "name", label: "Кампанія" },
                      { id: "objective", label: "Ціль" },
                      { id: "spend", label: "Spend", metricId: "spend", right: true },
                      { id: "results", label: "Results", metricId: "results", right: true },
                      { id: "cpr", label: "Cost/result", metricId: "costPerResult", right: true },
                      { id: "ctr", label: "CTR", metricId: "ctrLink", right: true },
                      { id: "cpm", label: "CPM", metricId: "cpm", right: true },
                      { id: "leads", label: "Leads", metricId: "leads", right: true },
                      { id: "cpl", label: "CPL", metricId: "cpl", right: true },
                      { id: "purch", label: "Purchases", metricId: "purchases", right: true },
                      { id: "roas", label: "ROAS", metricId: "roas", right: true },
                    ]}
                    rows={account.campaigns
                      .map((c) => ({ c, m: aggregate(account, rows.filter((r) => r.campaignId === c.id)) }))
                      .filter((x) => x.m.rows > 0)
                      .map(({ c, m }) => ({
                        key: c.id,
                        cells: {
                          name: { v: c.name, d: <Link href={`/ads-manager?highlight=${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link> },
                          objective: { v: c.objective, d: objectiveLabel(c.objective) },
                          spend: { v: m.spend, d: fmtMoney(m.spend) },
                          results: { v: m.results, d: <span title={m.resultLabel}>{fmtInt(m.results)}</span> },
                          cpr: { v: m.costPerResult, d: fmtMoney(m.costPerResult) },
                          ctr: { v: m.ctrLink, d: fmtPct(m.ctrLink) },
                          cpm: { v: m.cpm, d: fmtMoney(m.cpm) },
                          leads: { v: m.leads, d: fmtInt(m.leads) },
                          cpl: { v: m.cpl, d: fmtMoney(m.cpl) },
                          purch: { v: m.purchases, d: fmtInt(m.purchases) },
                          roas: { v: m.roas, d: fmtRoas(m.roas) },
                        },
                      }))}
                  />
                </Section>
              </TabsContent>

              <TabsContent value="creatives" className="grid gap-4 pt-4 lg:grid-cols-2">
                <BarCompare
                  title="CTR (link) за оголошеннями"
                  subtitle="Помаранчевий — найвищий CTR"
                  data={adsStats.map((x) => ({ name: x.ad.name, value: x.m.ctrLink, key: x.ad.id }))}
                  highlightKey={bestCtr?.ad.id}
                  format={(v) => `${fmtNum(v)}%`}
                />
                <BarCompare title="Cost per result за оголошеннями" data={adsStats.map((x) => ({ name: x.ad.name, value: x.m.costPerResult, key: x.ad.id }))} format={(v) => fmtMoney(v)} />
                <div className="lg:col-span-2">
                  <Section title="Статистична перевірка CTR" description="Довірчий інтервал Вілсона (95%) та двопропорційний z-тест відносно оголошення з найвищим CTR.">
                    <div className="overflow-x-auto">
                      <table className="data-table w-full text-xs">
                        <thead>
                          <tr>
                            <th scope="col">Оголошення</th>
                            <th scope="col" className="text-right">Покази</th>
                            <th scope="col" className="text-right">Link clicks</th>
                            <th scope="col" className="text-right">CTR</th>
                            <th scope="col" className="text-right">95% ДІ</th>
                            <th scope="col" className="text-right">p-value vs лідер</th>
                            <th scope="col" className="text-right">Конверсії</th>
                            <th scope="col" className="text-right">Cost/result</th>
                            <th scope="col">Висновок</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adsStats.map((x) => {
                            const ci = wilsonInterval(x.m.linkClicks, x.m.impressions);
                            const t = bestCtr && x.ad.id !== bestCtr.ad.id ? twoProportionZTest(bestCtr.m.linkClicks, bestCtr.m.impressions, x.m.linkClicks, x.m.impressions) : null;
                            const conv = x.m.leads + x.m.purchases;
                            return (
                              <tr key={x.ad.id}>
                                <td>{x.ad.name}</td>
                                <td className="num text-right">{fmtInt(x.m.impressions)}</td>
                                <td className="num text-right">{fmtInt(x.m.linkClicks)}</td>
                                <td className="num text-right">{fmtPct(x.m.ctrLink)}</td>
                                <td className="num text-right">{ci ? `${ci.low.toFixed(2)}–${ci.high.toFixed(2)}%` : "—"}</td>
                                <td className="num text-right">{t ? t.pValue.toFixed(3) : x.ad.id === bestCtr?.ad.id ? "лідер" : "—"}</td>
                                <td className="num text-right">{fmtInt(conv)}</td>
                                <td className="num text-right">{fmtMoney(x.m.costPerResult)}</td>
                                <td className="text-2xs">
                                  {x.ad.id === bestCtr?.ad.id
                                    ? "Найвищий CTR"
                                    : t && t.pValue < 0.05
                                      ? "CTR значуще нижчий"
                                      : "Різниця CTR незначуща"}
                                  {conv < 15 ? " · мало конверсій для висновку про вартість" : ""}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-2xs text-muted-foreground">
                      Значущість CTR не означає перевагу за вартістю конверсії. <ArticleLink slug="ab-testing">Як читати A/B тести</ArticleLink>
                    </p>
                  </Section>
                </div>
              </TabsContent>

              <TabsContent value="placements" className="grid gap-4 pt-4 lg:grid-cols-2">
                <BarCompare
                  title="Витрати за плейсментами"
                  data={[...placementTotals].sort((a, b) => b[1].spend - a[1].spend).map(([pid, t]) => ({ name: placementById(pid).label, value: t.spend }))}
                  format={(v) => fmtMoney(v)}
                />
                <BarCompare
                  title="LPV rate за плейсментами"
                  subtitle="Частка кліків, що стали переглядами сторінки"
                  data={[...placementTotals].filter(([, t]) => t.linkClicks > 20).map(([pid, t]) => ({ name: placementById(pid).label, value: t.linkClicks ? (t.lpv / t.linkClicks) * 100 : null }))}
                  format={(v) => `${fmtNum(v, 1)}%`}
                />
                <div className="lg:col-span-2">
                  <Section title="Розподіл за плейсментами">
                    <SortableTable
                      initialSort="spend"
                      columns={[
                        { id: "p", label: "Плейсмент" },
                        { id: "spend", label: "Spend", right: true },
                        { id: "share", label: "Частка витрат", right: true },
                        { id: "imp", label: "Impr.", right: true },
                        { id: "cpm", label: "CPM", right: true },
                        { id: "ctr", label: "CTR", right: true },
                        { id: "lpvr", label: "LPV rate", right: true },
                        { id: "conv", label: "Конверсії", right: true },
                        { id: "cpconv", label: "Cost/conv.", right: true },
                      ]}
                      rows={[...placementTotals].map(([pid, t]) => ({
                        key: pid,
                        cells: {
                          p: { v: placementById(pid).label, d: placementById(pid).label },
                          spend: { v: t.spend, d: fmtMoney(t.spend) },
                          share: { v: t.spend / Math.max(1e-9, total.spend), d: fmtPct((t.spend / Math.max(1e-9, total.spend)) * 100, 1) },
                          imp: { v: t.impressions, d: fmtInt(t.impressions) },
                          cpm: { v: t.impressions ? (t.spend / t.impressions) * 1000 : null, d: fmtMoney(t.impressions ? (t.spend / t.impressions) * 1000 : null) },
                          ctr: { v: t.impressions ? t.linkClicks / t.impressions : null, d: fmtPct(t.impressions ? (t.linkClicks / t.impressions) * 100 : null) },
                          lpvr: { v: t.linkClicks ? t.lpv / t.linkClicks : null, d: fmtPct(t.linkClicks ? (t.lpv / t.linkClicks) * 100 : null, 1) },
                          conv: { v: t.conversions, d: fmtInt(t.conversions) },
                          cpconv: { v: t.conversions ? t.spend / t.conversions : null, d: fmtMoney(t.conversions ? t.spend / t.conversions : null) },
                        },
                      }))}
                    />
                  </Section>
                </div>
              </TabsContent>

              <TabsContent value="audiences" className="pt-4">
                <Section title="Аудиторії (набори оголошень)" description="Тип аудиторії, оцінка розміру та ефективність.">
                  <SortableTable
                    initialSort="spend"
                    columns={[
                      { id: "name", label: "Набір" },
                      { id: "type", label: "Тип аудиторії" },
                      { id: "size", label: "Розмір", right: true },
                      { id: "spend", label: "Spend", right: true },
                      { id: "freq", label: "Frequency", metricId: "frequency", right: true },
                      { id: "cpm", label: "CPM", right: true },
                      { id: "ctr", label: "CTR", right: true },
                      { id: "cpr", label: "Cost/result", right: true },
                      { id: "phase", label: "Навчання" },
                    ]}
                    rows={account.adSets
                      .map((s) => ({ s, m: aggregate(account, rows.filter((r) => r.adSetId === s.id)) }))
                      .filter((x) => x.m.rows > 0)
                      .map(({ s, m }) => {
                        const est = estimateAudience(account, s.audience);
                        const type = s.audience.advantageAudience
                          ? "Advantage+ audience"
                          : est.hasRetargeting
                            ? "Ретаргетинг (custom)"
                            : est.hasLookalike
                              ? "Lookalike"
                              : s.audience.detailedTargeting.length
                                ? "Інтереси"
                                : "Широка (ручна)";
                        return {
                          key: s.id,
                          cells: {
                            name: { v: s.name, d: s.name },
                            type: { v: type, d: type },
                            size: { v: est.size, d: fmtCompact(est.size) },
                            spend: { v: m.spend, d: fmtMoney(m.spend) },
                            freq: { v: m.frequency, d: fmtNum(m.frequency) },
                            cpm: { v: m.cpm, d: fmtMoney(m.cpm) },
                            ctr: { v: m.ctrLink, d: fmtPct(m.ctrLink) },
                            cpr: { v: m.costPerResult, d: fmtMoney(m.costPerResult) },
                            phase: { v: s.learning.phase, d: s.learning.phase === "active" ? "Активна" : s.learning.phase === "learning" ? "Навчання" : s.learning.phase === "learning_limited" ? "Обмежене" : "—" },
                          },
                        };
                      })}
                  />
                </Section>
              </TabsContent>

              <TabsContent value="days" className="pt-4">
                <Section title="Breakdown за днями" description="Значення конверсій останніх днів можуть зрости через затримку.">
                  <div className="overflow-x-auto">
                    <table className="data-table w-full text-xs">
                      <thead>
                        <tr>
                          <th scope="col">День</th>
                          <th scope="col" className="text-right">Spend</th>
                          <th scope="col" className="text-right">Impr.</th>
                          <th scope="col" className="text-right">Reach</th>
                          <th scope="col" className="text-right">CPM</th>
                          <th scope="col" className="text-right">Link clicks</th>
                          <th scope="col" className="text-right">CTR</th>
                          <th scope="col" className="text-right">CPC</th>
                          <th scope="col" className="text-right">LPV</th>
                          <th scope="col" className="text-right">Leads</th>
                          <th scope="col" className="text-right">Purchases</th>
                          <th scope="col" className="text-right">Results</th>
                          <th scope="col" className="text-right">Cost/result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...series].reverse().map(({ day, m }) => (
                          <tr key={day}>
                            <td>{fmtSimDate(account.startDate, day, true)}</td>
                            <td className="num text-right">{fmtMoney(m.spend)}</td>
                            <td className="num text-right">{fmtInt(m.impressions)}</td>
                            <td className="num text-right">{fmtInt(m.reach)}</td>
                            <td className="num text-right">{fmtMoney(m.cpm)}</td>
                            <td className="num text-right">{fmtInt(m.linkClicks)}</td>
                            <td className="num text-right">{fmtPct(m.ctrLink)}</td>
                            <td className="num text-right">{fmtMoney(m.cpcLink)}</td>
                            <td className="num text-right">{fmtInt(m.landingPageViews)}</td>
                            <td className="num text-right">
                              {fmtInt(m.leads)}
                              {m.incomplete ? "*" : ""}
                            </td>
                            <td className="num text-right">
                              {fmtInt(m.purchases)}
                              {m.incomplete ? "*" : ""}
                            </td>
                            <td className="num text-right">{fmtInt(m.results)}</td>
                            <td className="num text-right">{fmtMoney(m.costPerResult)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              </TabsContent>

              <TabsContent value="funnel" className="grid gap-4 pt-4 lg:grid-cols-2">
                <Funnel
                  title="Воронка трафіку"
                  subtitle="Від показу до цільової дії"
                  steps={[
                    { label: "Impressions", value: total.impressions },
                    { label: "Link clicks", value: total.linkClicks },
                    { label: "Outbound clicks", value: total.outboundClicks },
                    { label: "Landing page views", value: total.landingPageViews },
                    ...(isSales
                      ? [
                          { label: "Add to cart", value: total.addToCarts },
                          { label: "Checkout", value: total.checkouts },
                          { label: "Purchases", value: total.purchases },
                        ]
                      : [{ label: "Leads", value: total.leads }]),
                  ]}
                />
                <Section title="Як читати воронку">
                  <ul className="space-y-1.5 text-xs">
                    <li>
                      <b>Покази → кліки</b> (CTR {fmtPct(total.ctrLink)}): якість креативу та релевантність аудиторії.
                    </li>
                    <li>
                      <b>Кліки → LPV</b> ({fmtPct(total.lpvRate, 1)}): швидкість сайту, якість плейсментів, коректність URL та Pixel.
                    </li>
                    <li>
                      <b>LPV → конверсія</b> ({fmtPct(isSales ? total.purchaseRate : total.leadRate)}): відповідність оферу, посадкова сторінка, наміри аудиторії.
                    </li>
                    <li className="text-muted-foreground">Падіння на одному кроці підказує, де шукати проблему, але не доводить причину — перевіряйте альтернативи.</li>
                  </ul>
                </Section>
              </TabsContent>

              <TabsContent value="plan" className="grid gap-4 pt-4 lg:grid-cols-2">
                <Section title="Бюджет: план vs факт" description="План = сума денних бюджетів у дні, коли об'єкти були активні.">
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md border p-2">
                      <dt className="text-muted-foreground">План</dt>
                      <dd className="num text-base font-semibold">{fmtMoney(planned)}</dd>
                    </div>
                    <div className="rounded-md border p-2">
                      <dt className="text-muted-foreground">Факт</dt>
                      <dd className="num text-base font-semibold">{fmtMoney(total.spend)}</dd>
                    </div>
                    <div className="rounded-md border p-2">
                      <dt className="text-muted-foreground">Виконання</dt>
                      <dd className="num text-base font-semibold">{fmtPct(planned ? (total.spend / planned) * 100 : null, 1)}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-2xs text-muted-foreground">Недовитрата понад ~10% зазвичай означає обмеження доставки: замала аудиторія, низька ставка/ціль вартості або вичерпаний баланс.</p>
                </Section>
                <Section title="KPI" description={mission ? `KPI з брифу місії ${mission.number}` : "Для акаунтів місій тут з'являються KPI з брифу."}>
                  {mission ? (
                    <table className="data-table w-full text-xs">
                      <thead>
                        <tr>
                          <th scope="col">KPI</th>
                          <th scope="col">Ціль</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mission.brief.kpis.map((k) => (
                          <tr key={k.label}>
                            <td className="whitespace-normal">{k.label}</td>
                            <td className="whitespace-normal">{k.target}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-muted-foreground">У пісочниці порівнюйте з власними цілями: CPL, CPA, ROAS ≥ беззбиткового ({fmtRoas(beRoas)}).</p>
                  )}
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Cost per result</dt>
                      <dd className="num font-semibold">{fmtMoney(total.costPerResult)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">CPL / CPA</dt>
                      <dd className="num font-semibold">
                        {fmtMoney(total.cpl)} / {fmtMoney(total.cpa)}
                      </dd>
                    </div>
                  </dl>
                </Section>
              </TabsContent>

              <TabsContent value="crm" className="grid gap-4 pt-4 lg:grid-cols-2">
                <TrendChart
                  title="Ліди: кабінет vs CRM"
                  subtitle="Обидві серії в лідах — одна вісь"
                  data={chartData}
                  xKey="date"
                  series={[
                    { key: "leads", label: "Ліди в кабінеті (атрибуція)" },
                    { key: "crm", label: "Ліди з джерелом Meta в CRM" },
                  ]}
                  format={(v) => fmtNum(v, 0)}
                />
                <Section title="Звірка" description="CRM-дані недоступні в рекламному кабінеті — це «правда» бізнесу в симуляторі.">
                  <table className="data-table w-full text-xs">
                    <thead>
                      <tr>
                        <th scope="col">Показник</th>
                        <th scope="col" className="text-right">Кабінет</th>
                        <th scope="col" className="text-right">CRM / бекенд</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Ліди</td>
                        <td className="num text-right">{fmtInt(total.leads)}</td>
                        <td className="num text-right">
                          {fmtInt(total.trueLeads)} усього · {fmtInt(total.crmLeads)} з джерелом Meta
                        </td>
                      </tr>
                      <tr>
                        <td>Кваліфіковані ліди</td>
                        <td className="num text-right">—</td>
                        <td className="num text-right">
                          {fmtInt(total.qualifiedLeads)} ({fmtPct(total.qualifiedRate, 1)})
                        </td>
                      </tr>
                      <tr>
                        <td>Продажі з лідів (очікувано)</td>
                        <td className="num text-right">—</td>
                        <td className="num text-right">{fmtInt(total.salesFromLeads)}</td>
                      </tr>
                      <tr>
                        <td>Покупки</td>
                        <td className="num text-right">{fmtInt(total.purchases)}</td>
                        <td className="num text-right">
                          {fmtInt(total.truePurchases)} · {fmtInt(total.crmPurchases)} з UTM Meta
                        </td>
                      </tr>
                      <tr>
                        <td>Вартість кваліфікованого ліда</td>
                        <td className="num text-right">—</td>
                        <td className="num text-right">{fmtMoney(total.costPerQualifiedLead)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <ul className="mt-3 space-y-1 text-2xs text-muted-foreground">
                    <li>• Кабінет атрибутує конверсії за вікном (click/engage/view) і втрачає частину сигналу (блокувальники, згода).</li>
                    <li>• CRM бачить джерело лише за UTM; без них лід стає «(not set)».</li>
                    <li>• Дані останніх днів у кабінеті неповні через затримку конверсій.</li>
                  </ul>
                  <p className="mt-2 text-2xs">
                    <ArticleLink slug="crm-discrepancies">Розбіжності Meta vs CRM</ArticleLink>
                  </p>
                </Section>
              </TabsContent>

              <TabsContent value="finance" className="grid gap-4 pt-4 lg:grid-cols-2">
                <Section title="Фінансова ефективність" description={`Маржа бізнесу: ${Math.round(account.economics.margin * 100)}% · середній чек $${account.economics.averageOrderValue}`}>
                  <table className="data-table w-full text-xs">
                    <tbody>
                      <tr>
                        <td>Витрати</td>
                        <td className="num text-right">{fmtMoney(total.spend)}</td>
                      </tr>
                      <tr>
                        <td>Дохід (атрибутований кабінетом)</td>
                        <td className="num text-right">{fmtMoney(total.purchaseValue)}</td>
                      </tr>
                      <tr>
                        <td>Дохід (бекенд: покупки + продажі з лідів)</td>
                        <td className="num text-right">{fmtMoney(revenueBackend)}</td>
                      </tr>
                      <tr>
                        <td>
                          <MetricLabel id="roas">ROAS (кабінет)</MetricLabel>
                        </td>
                        <td className="num text-right">{fmtRoas(total.roas)}</td>
                      </tr>
                      <tr>
                        <td>
                          <MetricLabel id="businessRoas">ROAS (бізнес)</MetricLabel>
                        </td>
                        <td className="num text-right">{fmtRoas(total.businessRoas)}</td>
                      </tr>
                      <tr>
                        <td>Беззбитковий ROAS = 1 / маржа</td>
                        <td className="num text-right">{fmtRoas(beRoas)}</td>
                      </tr>
                      <tr className="font-semibold">
                        <td>Валовий прибуток після реклами (бекенд)</td>
                        <td className={cn("num text-right", profit >= 0 ? "text-success" : "text-destructive")}>{fmtMoney(profit)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-2 text-2xs text-muted-foreground">Спрощена модель: не враховує повернення, LTV, постійні витрати. <ArticleLink slug="ecommerce">E-commerce економіка</ArticleLink></p>
                </Section>
                <TrendChart
                  title="Покупки: кабінет vs бекенд"
                  data={chartData}
                  xKey="date"
                  series={[
                    { key: "purchases", label: "Покупки в кабінеті" },
                    { key: "backend", label: "Покупки в бекенді" },
                  ]}
                  format={(v) => fmtNum(v, 0)}
                />
              </TabsContent>

              <TabsContent value="attribution" className="pt-4">
                <Section title="Порівняння вікон атрибуції" description="Ті самі покази й кліки — різні правила приписування конверсій.">
                  <table className="data-table w-full text-xs">
                    <thead>
                      <tr>
                        <th scope="col">Вікно</th>
                        <th scope="col" className="text-right">Leads</th>
                        <th scope="col" className="text-right">CPL</th>
                        <th scope="col" className="text-right">Purchases</th>
                        <th scope="col" className="text-right">CPA</th>
                        <th scope="col" className="text-right">ROAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ATTRIBUTION_PRESETS.map((p) => {
                        const m: ReportedMetrics = aggregate(account, rows, { attribution: p.setting });
                        return (
                          <tr key={p.id}>
                            <td>{p.label}</td>
                            <td className="num text-right">{fmtInt(m.leads)}</td>
                            <td className="num text-right">{fmtMoney(m.cpl)}</td>
                            <td className="num text-right">{fmtInt(m.purchases)}</td>
                            <td className="num text-right">{fmtMoney(m.cpa)}</td>
                            <td className="num text-right">{fmtRoas(m.roas)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="mt-2 text-2xs text-muted-foreground">
                    Ширше вікно ≠ «краща реклама»: воно приписує рекламі більше конверсій, частина з яких сталася б і без неї. <ArticleLink slug="attribution">Атрибуція</ArticleLink>
                  </p>
                </Section>
              </TabsContent>

              <TabsContent value="diagnostics" className="grid gap-3 pt-4">
                {findings.length === 0 ? (
                  <EmptyState title="Критичних сигналів не знайдено" description="Це не гарантія оптимальності: перевірте креативи, аудиторії та економіку вручну." />
                ) : (
                  findings.map((f) => <FindingCard key={f.id} f={f} />)
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
