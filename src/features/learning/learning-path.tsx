"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { BookOpen, CheckCircle2, Circle, Dumbbell, Flag, Lock, Target } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { LEARNING_PATH } from "@/content/learning-path";
import { getArticle } from "@/content/knowledge";
import { getMission, PASS_SCORE } from "@/content/missions";
import { SANDBOX_ACCOUNT_ID } from "@/content/sandbox";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/common";
import { bestScores, LEVEL_LABELS, useLevel } from "./progress";

export function LearningPath() {
  const learning = useAppStore((s) => s.learning);
  const attempts = useAppStore((s) => s.missionAttempts);
  const sandbox = useAppStore((s) => s.accounts[SANDBOX_ACCOUNT_ID]);
  const completePractice = useAppStore((s) => s.completePractice);
  const level = useLevel();
  const scores = useMemo(() => bestScores(attempts), [attempts]);
  const currentIndex = LEARNING_PATH.findIndex((l) => l.id === level.level);

  // Автоматично зараховуємо практичні завдання, які вже виконано в пісочниці.
  useEffect(() => {
    for (const l of LEARNING_PATH)
      for (const m of l.modules)
        if (m.practice && !learning.completedPractice.includes(m.practice.id) && m.practice.check(sandbox)) {
          completePractice(m.practice.id);
          toast.success("Практичне завдання виконано", { description: m.practice.title });
        }
  }, [sandbox, learning.completedPractice, completePractice]);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Learning Path"
        description="Маршрут від Beginner до Advanced Performance Marketer: коротка теорія → практична дія в симуляторі → тест → місія. Фінальна місія рівня відкриває наступний."
        actions={
          <div className="w-56">
            <div className="mb-1 flex justify-between text-2xs text-muted-foreground">
              <span>Прогрес маршруту</span>
              <span>{level.pathProgress}%</span>
            </div>
            <Progress value={level.pathProgress} />
          </div>
        }
      />
      <div className="grid gap-6 p-4 sm:p-6">
        {LEARNING_PATH.map((l, li) => {
          const locked = li > currentIndex && !level.completedPath;
          const finalMission = getMission(l.finalMission)!;
          const finalPassed = (scores[l.finalMission] ?? 0) >= PASS_SCORE;
          return (
            <section key={l.id} className={cn("rounded-lg border bg-card", li === currentIndex && "ring-1 ring-primary/40")} aria-labelledby={`lvl-${l.id}`}>
              <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{li + 1}</span>
                <div className="min-w-0 flex-1">
                  <h2 id={`lvl-${l.id}`} className="text-sm font-semibold">
                    {LEVEL_LABELS[l.id]}
                  </h2>
                  <p className="text-2xs text-muted-foreground">{l.description}</p>
                </div>
                {finalPassed ? <Badge variant="success">Рівень пройдено</Badge> : li === currentIndex ? <Badge>Поточний рівень</Badge> : locked ? <Badge variant="secondary"><Lock className="h-3 w-3" /> Рекомендовано пізніше</Badge> : null}
              </header>
              <ol className="grid gap-3 p-4 lg:grid-cols-2">
                {l.modules.map((m, mi) => {
                  const practiceDone = m.practice ? learning.completedPractice.includes(m.practice.id) : true;
                  return (
                    <li key={m.id} className="rounded-md border p-3">
                      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Модуль {li + 1}.{mi + 1}</p>
                      <h3 className="text-[13px] font-semibold">{m.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{m.theory}</p>
                      <ul className="mt-2 grid gap-1 text-xs">
                        {m.articles.map((slug) => {
                          const a = getArticle(slug);
                          const read = learning.readArticles.includes(slug);
                          const quiz = learning.quizResults[slug];
                          return (
                            <li key={slug} className="flex items-center gap-1.5">
                              {read ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />}
                              <Link href={`/knowledge/${slug}`} className="text-primary hover:underline">
                                {a?.title ?? slug}
                              </Link>
                              {quiz && <Badge variant="outline">тест {quiz.correct}/{quiz.total}</Badge>}
                            </li>
                          );
                        })}
                        {m.practice && (
                          <li className="mt-1 rounded-md bg-muted/50 p-2">
                            <span className="flex items-center gap-1.5 font-medium">
                              {practiceDone ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Dumbbell className="h-3.5 w-3.5 text-primary" />}
                              Практика: {m.practice.title}
                            </span>
                            <span className="block text-2xs text-muted-foreground">{m.practice.instructions}</span>
                            {!practiceDone && (
                              <Button size="xs" variant="outline" className="mt-1.5" asChild>
                                <Link href={m.practice.href} onClick={() => useAppStore.getState().setActiveAccount(SANDBOX_ACCOUNT_ID)}>
                                  Виконати в пісочниці
                                </Link>
                              </Button>
                            )}
                          </li>
                        )}
                        {m.missions.map((id) => {
                          const ms = getMission(id)!;
                          const sc = scores[id];
                          return (
                            <li key={id} className="flex items-center gap-1.5">
                              {sc !== undefined && sc >= PASS_SCORE ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Target className="h-3.5 w-3.5 text-muted-foreground" />}
                              <Link href={`/missions/${id}`} className="text-primary hover:underline">
                                Місія {ms.number}: {ms.title}
                              </Link>
                              {sc !== undefined && <Badge variant={sc >= PASS_SCORE ? "success" : "warning"}>{sc}</Badge>}
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
                <li className="rounded-md border border-dashed p-3 lg:col-span-2">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                    <Flag className="h-4 w-4 text-primary" /> Фінальне завдання рівня
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {finalPassed ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span>
                      Місія {finalMission.number}: {finalMission.title} (≥ {PASS_SCORE} балів)
                    </span>
                    <Button size="xs" className="ml-auto" asChild>
                      <Link href={`/missions/${finalMission.id}`}>Відкрити</Link>
                    </Button>
                  </div>
                </li>
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
