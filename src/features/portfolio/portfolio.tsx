"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Download, FileText, FlaskConical, Printer } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { getMission, PASS_SCORE } from "@/content/missions";
import { objectiveLabel } from "@/domain/catalog";
import type { MissionAttempt } from "@/domain/types";
import { fmtDateTime } from "@/lib/dates";
import { fmtInt, fmtMoney, fmtNum, fmtPct, fmtRoas } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/common";
import { DIMENSION_LABELS } from "@/scoring/evaluate-mission";
import { TrendChart } from "@/features/analytics/charts";
import { Brief } from "@/features/missions/mission-detail";
import type { SkillDimension } from "@/domain/types";

export function PortfolioIndex() {
  const attempts = useAppStore((s) => s.missionAttempts);
  const list = useMemo(
    () => Object.values(attempts).filter((a) => a.status === "submitted").sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "")),
    [attempts],
  );
  return (
    <div className="flex flex-col">
      <PageHeader title="Portfolio" description="Навчальні кейси з виконаних місій. Усі результати отримано в симуляторі, а не в реальному рекламному акаунті." />
      <div className="p-4 sm:p-6">
        {list.length === 0 ? (
          <EmptyState
            title="Портфоліо порожнє"
            description="Здайте першу місію — кейс з брифом, стратегією, структурою, результатами симуляції та висновками з'явиться тут."
            action={
              <Button asChild>
                <Link href="/missions">До Mission Center</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((a) => {
              const m = getMission(a.missionId);
              return (
                <li key={a.id}>
                  <Link href={`/portfolio/case?id=${a.id}`} className="flex h-full flex-col gap-2 rounded-lg border bg-card p-4 hover:border-primary/40 hover:bg-accent/30">
                    <span className="flex items-center justify-between">
                      <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Місія {m?.number}</span>
                      <Badge variant={(a.assessment?.total ?? 0) >= PASS_SCORE ? "success" : "warning"}>{a.assessment?.total ?? "—"}/100</Badge>
                    </span>
                    <span className="text-[13px] font-semibold">{m?.title}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{a.caseStudy.strategy || m?.summary}</span>
                    <span className="mt-auto text-2xs text-muted-foreground">{a.submittedAt ? fmtDateTime(a.submittedAt) : ""}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function toMarkdown(a: MissionAttempt): string {
  const m = getMission(a.missionId);
  const s = a.snapshot;
  const lines = [
    `# Навчальний кейс: ${m?.title ?? a.missionId}`,
    "",
    "> Результати отримано в навчальному симуляторі AdLab, а не в реальному рекламному акаунті.",
    "",
    `**Оцінка:** ${a.assessment?.total ?? "—"}/100 · ${a.submittedAt ?? ""}`,
    "",
    "## Бриф",
    m ? `${m.brief.business}\n\n${m.brief.goal}\n\nБюджет: ${m.brief.budget}` : "",
    "",
    "## Стратегія",
    a.caseStudy.strategy,
    "",
    "## Структура кампаній",
    ...(s?.campaigns ?? []).flatMap((c) => [`- **${c.name}** — ${c.budget}`, ...c.adSets.map((x) => `  - ${x.name}: ${x.summary}`)]),
    "",
    "## Гіпотези",
    a.caseStudy.hypotheses,
    "",
    "## Тестування",
    a.caseStudy.testing,
    "",
    "## Результати симуляції",
    s ? `Spend ${fmtMoney(s.totals.spend)}, impressions ${fmtInt(s.totals.impressions)}, CTR ${fmtPct(s.totals.ctr)}, leads ${fmtInt(s.totals.leads)}, CPL ${fmtMoney(s.totals.cpl)}, purchases ${fmtInt(s.totals.purchases)}, ROAS ${fmtRoas(s.totals.roas)}` : "",
    "",
    "## Аналіз",
    a.caseStudy.analysis,
    "",
    "## Наступні кроки",
    a.caseStudy.nextSteps,
    "",
    "## Висновки",
    a.caseStudy.conclusions,
  ];
  return lines.join("\n");
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** Кейс за ?id=… (query-параметр замість динамічного сегмента — сумісно зі статичним хостингом). */
export function CaseFromQuery() {
  const id = useSearchParams().get("id") ?? "";
  return <CaseView attemptId={id} />;
}

export function CaseView({ attemptId }: { attemptId: string }) {
  const a = useAppStore((s) => s.missionAttempts[attemptId]);
  const name = useAppStore((s) => s.profile.displayName);
  if (!a || a.status !== "submitted") return <EmptyState title="Кейс не знайдено" description="Кейс з'являється після здачі місії." />;
  const m = getMission(a.missionId);
  const s = a.snapshot;
  const dims = a.assessment ? (Object.keys(a.assessment.dimensions) as SkillDimension[]).filter((d) => a.assessment!.dimensions[d].score !== null) : [];
  const section = (title: string, text: string) => (
    <section className="break-inside-avoid">
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      <p className="whitespace-pre-line text-[13px] leading-relaxed">{text.trim() || "—"}</p>
    </section>
  );
  return (
    <div className="flex flex-col">
      <div className="no-print">
        <PageHeader
          title={`Кейс: ${m?.title ?? ""}`}
          description="Друкований звіт / PDF через діалог друку браузера («Зберегти як PDF»)."
          actions={
            <>
              <Button size="sm" variant="outline" onClick={() => download(`case-${a.missionId}.md`, toMarkdown(a), "text/markdown;charset=utf-8")}>
                <FileText /> Markdown
              </Button>
              <Button size="sm" variant="outline" onClick={() => download(`case-${a.missionId}.json`, JSON.stringify(a, null, 2), "application/json")}>
                <Download /> JSON
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <Printer /> Друк / PDF
              </Button>
            </>
          }
        />
      </div>
      <article className="print-area mx-auto my-4 grid w-full max-w-4xl gap-5 rounded-lg border bg-card p-6 shadow-sm sm:my-6 sm:p-8">
        <header className="border-b pb-4">
          <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-info">
            <FlaskConical className="h-3.5 w-3.5" /> Навчальний кейс · результати отримано в симуляторі, а не в реальному рекламному акаунті
          </p>
          <h1 className="mt-2 text-xl font-semibold">{m?.title}</h1>
          <p className="text-xs text-muted-foreground">
            {name} · місія {m?.number} · {a.submittedAt ? fmtDateTime(a.submittedAt) : ""} · симульовано днів: {s?.simDays ?? "—"}
          </p>
        </header>
        {m && (
          <section className="break-inside-avoid">
            <h2 className="mb-2 text-sm font-semibold">Бриф</h2>
            <Brief mission={m} />
          </section>
        )}
        {section("Стратегія", a.caseStudy.strategy)}
        <section className="break-inside-avoid">
          <h2 className="mb-2 text-sm font-semibold">Структура кампаній і бюджетний план</h2>
          <ul className="grid gap-2 text-xs">
            {(s?.campaigns ?? []).map((c) => (
              <li key={c.name} className="rounded-md border p-2.5">
                <p className="font-medium">
                  {c.name} <span className="font-normal text-muted-foreground">· {objectiveLabel(c.objective)}</span>
                </p>
                <p className="text-muted-foreground">{c.budget}</p>
                <ul className="mt-1 grid gap-0.5 pl-3">
                  {c.adSets.map((x) => (
                    <li key={x.name}>
                      ▸ {x.name} — <span className="text-muted-foreground">{x.summary}</span>
                      {x.ads.length > 0 && <span className="block pl-3 text-2xs text-muted-foreground">Оголошення: {x.ads.join(", ")}</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
        {section("Гіпотези", a.caseStudy.hypotheses)}
        {section("Тестування", a.caseStudy.testing)}
        {s && (
          <section className="break-inside-avoid">
            <h2 className="mb-2 text-sm font-semibold">Результати симуляції</h2>
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {[
                ["Spend", fmtMoney(s.totals.spend)],
                ["Impressions", fmtInt(s.totals.impressions)],
                ["Reach", fmtInt(s.totals.reach)],
                ["CTR (link)", fmtPct(s.totals.ctr)],
                ["CPC", fmtMoney(s.totals.cpc)],
                ["CPM", fmtMoney(s.totals.cpm)],
                ["LPV", fmtInt(s.totals.landingPageViews)],
                ["Leads / CPL", `${fmtInt(s.totals.leads)} / ${fmtMoney(s.totals.cpl)}`],
                ["Кваліф. ліди (CRM)", fmtInt(s.totals.qualifiedLeads)],
                ["Purchases", fmtInt(s.totals.purchases)],
                ["ROAS", fmtRoas(s.totals.roas)],
                ["Дохід (бекенд)", fmtMoney(s.totals.trueRevenue)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border p-2">
                  <dt className="text-2xs text-muted-foreground">{k}</dt>
                  <dd className="num font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            {s.daily.length > 1 && (
              <div className="mt-3">
                <TrendChart title="Витрати по днях" data={s.daily.map((d) => ({ date: d.date.slice(0, 5), spend: d.spend }))} xKey="date" series={[{ key: "spend", label: "Spend" }]} format={(v) => fmtMoney(v)} height={180} />
              </div>
            )}
          </section>
        )}
        {section("Аналіз", a.caseStudy.analysis)}
        {section("Наступні кроки", a.caseStudy.nextSteps)}
        {section("Висновки", a.caseStudy.conclusions)}
        {a.assessment && (
          <section className="break-inside-avoid border-t pt-4">
            <h2 className="mb-2 text-sm font-semibold">Оцінка навичок: {a.assessment.total}/100</h2>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
              {dims.map((d) => (
                <li key={d} className="flex justify-between">
                  <span>{DIMENSION_LABELS[d]}</span>
                  <span className="num font-medium">{fmtNum(a.assessment!.dimensions[d].score, 0)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <footer className="border-t pt-3 text-2xs text-muted-foreground">
          AdLab Simulator — навчальний продукт, не пов&apos;язаний з Meta Platforms, Inc. Показники згенеровано навчальною моделлю і не є прогнозом реальної ефективності.
        </footer>
      </article>
    </div>
  );
}
