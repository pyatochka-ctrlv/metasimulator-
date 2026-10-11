"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { ArrowRight, CheckCircle2, Circle, GraduationCap, ListChecks, Megaphone, Plus, Target, TriangleAlert } from "lucide-react";
import { useAppStore, type AppData } from "@/store/app-store";
import { MISSIONS, PASS_SCORE } from "@/content/missions";
import { ARTICLES, getArticle } from "@/content/knowledge";
import { LEARNING_PATH } from "@/content/learning-path";
import { objectiveLabel } from "@/domain/catalog";
import type { SkillDimension } from "@/domain/types";
import { aggregate } from "@/simulation/reporting";
import { validateCampaignTree } from "@/simulation/validation";
import { DIMENSION_ARTICLES, DIMENSION_LABELS } from "@/scoring/evaluate-mission";
import { fmtCompact, fmtInt, fmtMoney } from "@/lib/format";
import { fmtDateTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader, Section, SimulatedNotice, StatTile } from "@/components/common";
import { getDelivery, TONE_DOT } from "@/features/ads-manager/delivery";
import { bestScores, useLevel } from "@/features/learning/progress";
import { cn } from "@/lib/utils";
import { tasksForDay, todayKey } from "./daily-tasks";

export function Dashboard() {
  const state = useAppStore();
  const level = useLevel();
  const today = todayKey();
  const data: AppData = state;
  const scores = useMemo(() => bestScores(state.missionAttempts), [state.missionAttempts]);
  const passed = Object.values(scores).filter((s) => s >= PASS_SCORE).length;
  const active = state.accounts[state.activeAccountId];

  const totals = useMemo(() => {
    let spend = 0;
    let impressions = 0;
    let conversions = 0;
    let campaigns = 0;
    for (const a of Object.values(state.accounts)) {
      const r = aggregate(a, a.metrics);
      spend += r.spend;
      impressions += r.impressions;
      conversions += r.leads + r.purchases;
      campaigns += a.campaigns.length;
    }
    return { spend, impressions, conversions, campaigns };
  }, [state.accounts]);

  const recent = useMemo(
    () =>
      Object.values(state.accounts)
        .flatMap((a) => a.campaigns.map((c) => ({ a, c })))
        .sort((x, y) => y.c.updatedAt.localeCompare(x.c.updatedAt))
        .slice(0, 6),
    [state.accounts],
  );

  const mistakes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const att of Object.values(state.missionAttempts)) for (const e of att.assessment?.criticalErrors ?? []) counts.set(e, (counts.get(e) ?? 0) + 1);
    if (active && !active.readOnly)
      for (const c of active.campaigns) for (const i of validateCampaignTree(active, c.id).filter((x) => x.level === "warning")) counts.set(i.message, (counts.get(i.message) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [state.missionAttempts, active]);

  const weakDims = useMemo(() => {
    const agg = new Map<SkillDimension, { e: number; a: number }>();
    for (const att of Object.values(state.missionAttempts)) {
      if (!att.assessment) continue;
      for (const [d, v] of Object.entries(att.assessment.dimensions) as [SkillDimension, { earned: number; available: number }][]) {
        const cur = agg.get(d) ?? { e: 0, a: 0 };
        agg.set(d, { e: cur.e + v.earned, a: cur.a + v.available });
      }
    }
    return [...agg].filter(([, v]) => v.a > 0).map(([d, v]) => ({ d, score: Math.round((v.e / v.a) * 100) })).sort((a, b) => a.score - b.score).slice(0, 3);
  }, [state.missionAttempts]);

  const currentLevel = LEARNING_PATH.find((l) => l.id === level.level)!;
  const unread = currentLevel.modules.flatMap((m) => m.articles).filter((s) => !state.learning.readArticles.includes(s)).slice(0, 3);
  const dailyTasks = tasksForDay(today);
  const doneToday = state.learning.completedDailyTasks[today] ?? [];

  // Автоматичне зарахування виконаних щоденних завдань
  useEffect(() => {
    for (const t of dailyTasks) if (!doneToday.includes(t.id) && t.check(data, today)) state.completeDailyTask(today, t.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, today]);

  const spentActive = active ? active.metrics.reduce((a, m) => a + m.spend, 0) : 0;

  return (
    <div className="flex flex-col">
      <PageHeader
        title={`Вітаємо, ${state.profile.displayName}`}
        description="Навчальний робочий простір медіабаєра: запускайте кампанії в симуляторі, проходьте місії, розбирайте помилки й збирайте портфоліо."
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link href="/ads-manager">
                <Megaphone /> Ads Manager
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/campaign-builder">
                <Plus /> Нова кампанія
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-4 p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <GraduationCap className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Рівень</p>
                <p className="text-base font-semibold">{level.label}</p>
                <p className="text-xs text-muted-foreground">
                  {level.xp} XP · {level.nextStep}
                </p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href="/learning">Маршрут</Link>
              </Button>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-2xs text-muted-foreground">
                <span>Загальний прогрес навчання</span>
                <span className="num">{level.pathProgress}%</span>
              </div>
              <Progress value={level.pathProgress} />
            </div>
          </section>
          <Section
            title={
              <span className="flex items-center gap-1.5">
                <ListChecks className="h-4 w-4 text-primary" /> Завдання на сьогодні
              </span>
            }
            description="Перевіряються автоматично за вашими діями."
          >
            <ul className="grid gap-2">
              {dailyTasks.map((t) => {
                const done = doneToday.includes(t.id);
                return (
                  <li key={t.id} className="flex items-start gap-2 text-xs">
                    {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                    <span className="min-w-0 flex-1">
                      <span className={cn("font-medium", done && "text-muted-foreground line-through")}>{t.title}</span>
                      <span className="block text-2xs text-muted-foreground">{t.hint}</span>
                    </span>
                    {!done && (
                      <Button size="xs" variant="ghost" asChild>
                        <Link href={t.href}>
                          <ArrowRight />
                        </Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Місій зараховано" value={`${passed} / ${MISSIONS.length}`} />
          <StatTile label="Статей прочитано" value={`${state.learning.readArticles.length} / ${ARTICLES.length}`} />
          <StatTile label="Віртуальний бюджет" value={fmtMoney(active ? active.virtualBudget - spentActive : 0, 0)} sub={active ? `залишок в «${active.name.slice(0, 22)}…»` : ""} />
          <StatTile label="Симульовані витрати" value={fmtMoney(totals.spend, 0)} sub="усі навчальні акаунти" />
          <StatTile label="Покази" value={fmtCompact(totals.impressions)} sub="усі акаунти" />
          <StatTile label="Конверсії" value={fmtInt(totals.conversions)} sub="ліди + покупки (атрибуція)" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Останні кампанії" actions={<Link href="/ads-manager" className="text-xs text-primary hover:underline">Усі →</Link>}>
            {recent.length === 0 ? (
              <p className="text-xs text-muted-foreground">Кампаній ще немає.</p>
            ) : (
              <table className="data-table w-full text-xs">
                <thead>
                  <tr>
                    <th scope="col">Кампанія</th>
                    <th scope="col">Статус</th>
                    <th scope="col" className="text-right">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(({ a, c }) => {
                    const d = getDelivery(a, "campaign", c);
                    const r = aggregate(a, a.metrics.filter((m) => m.campaignId === c.id));
                    return (
                      <tr key={c.id}>
                        <td className="max-w-[240px]">
                          <button
                            type="button"
                            className="block max-w-full truncate text-left font-medium text-primary hover:underline"
                            onClick={() => {
                              state.setActiveAccount(a.id);
                              window.location.href = `/ads-manager?highlight=${c.id}`;
                            }}
                          >
                            {c.name}
                          </button>
                          <span className="block truncate text-2xs text-muted-foreground">
                            {objectiveLabel(c.objective)} · {a.name}
                          </span>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn("h-2 w-2 rounded-full", TONE_DOT[d.tone])} /> {d.label}
                          </span>
                        </td>
                        <td className="num text-right">{fmtMoney(r.spend)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Section>
          <Section title="Місії" actions={<Link href="/missions" className="text-xs text-primary hover:underline">Mission Center →</Link>}>
            <ul className="grid gap-1.5 text-xs">
              {MISSIONS.filter((m) => m.level === level.level || (scores[m.id] === undefined && m.level === "beginner"))
                .slice(0, 5)
                .map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                    <Link href={`/missions/${m.id}`} className="text-primary hover:underline">
                      Місія {m.number}: {m.title}
                    </Link>
                    {scores[m.id] !== undefined && (
                      <Badge variant={scores[m.id] >= PASS_SCORE ? "success" : "warning"} className="ml-auto">
                        {scores[m.id]}
                      </Badge>
                    )}
                  </li>
                ))}
            </ul>
            {Object.values(state.missionAttempts).filter((a) => a.submittedAt).length > 0 && (
              <p className="mt-3 text-2xs text-muted-foreground">
                Остання здача:{" "}
                {fmtDateTime(
                  Object.values(state.missionAttempts)
                    .map((a) => a.submittedAt ?? "")
                    .sort()
                    .at(-1)!,
                )}
              </p>
            )}
          </Section>
          <Section
            title={
              <span className="flex items-center gap-1.5">
                <TriangleAlert className="h-4 w-4 text-warning" /> Типові помилки
              </span>
            }
            description="З ваших оцінених місій та попереджень у поточному акаунті."
          >
            {mistakes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Поки що помилок не зафіксовано. Здавайте місії й публікуйте кампанії — тут з&apos;явиться персональна статистика.</p>
            ) : (
              <ul className="grid gap-1.5 text-xs">
                {mistakes.map(([m, n]) => (
                  <li key={m} className="flex gap-2">
                    <Badge variant="secondary" className="shrink-0">
                      ×{n}
                    </Badge>
                    {m}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Що вивчати далі">
            <ul className="grid gap-1.5 text-xs">
              {weakDims.map((w) => (
                <li key={w.d} className="flex items-center gap-2">
                  <Badge variant={w.score >= 70 ? "success" : "warning"}>{w.score}</Badge>
                  <span>{DIMENSION_LABELS[w.d]} →</span>
                  <Link href={`/knowledge/${DIMENSION_ARTICLES[w.d]}`} className="text-primary hover:underline">
                    {getArticle(DIMENSION_ARTICLES[w.d])?.title}
                  </Link>
                </li>
              ))}
              {unread.map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <Badge variant="outline">рівень</Badge>
                  <Link href={`/knowledge/${s}`} className="text-primary hover:underline">
                    {getArticle(s)?.title}
                  </Link>
                </li>
              ))}
              {weakDims.length === 0 && unread.length === 0 && <li className="text-muted-foreground">Усі статті поточного рівня прочитано — переходьте до фінальної місії рівня.</li>}
            </ul>
          </Section>
        </div>
        <SimulatedNotice />
      </div>
    </div>
  );
}
