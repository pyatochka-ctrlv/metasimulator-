"use client";

import Link from "next/link";
import { AlertOctagon, CheckCircle2, Info, Lightbulb, TriangleAlert } from "lucide-react";
import type { SkillAssessment, SkillDimension } from "@/domain/types";
import { DIMENSION_LABELS } from "@/scoring/evaluate-mission";
import { PASS_SCORE } from "@/content/missions";
import { getArticle } from "@/content/knowledge";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Section } from "@/components/common";

export function ScoreBadge({ score }: { score: number }) {
  return <Badge variant={score >= PASS_SCORE ? "success" : score >= 50 ? "warning" : "destructive"}>{score}/100</Badge>;
}

export function AssessmentReport({ a }: { a: SkillAssessment }) {
  const passed = a.total >= PASS_SCORE;
  const dims = (Object.keys(a.dimensions) as SkillDimension[]).filter((d) => a.dimensions[d].score !== null);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-[200px_1fr]">
        <div className="flex flex-col items-center justify-center gap-1 text-center">
          <span className={cn("num text-5xl font-semibold", passed ? "text-success" : "text-destructive")} aria-label={`Підсумковий бал ${a.total} зі 100`}>
            {a.total}
          </span>
          <span className="text-xs text-muted-foreground">Skill Score / 100</span>
          <Badge variant={passed ? "success" : "destructive"}>{passed ? "Місію зараховано" : `Не зараховано (потрібно ${PASS_SCORE})`}</Badge>
        </div>
        <div className="grid gap-2">
          {dims.map((d) => (
            <div key={d} className="grid grid-cols-[150px_1fr_40px] items-center gap-2 text-xs">
              <span>{DIMENSION_LABELS[d]}</span>
              <Progress value={a.dimensions[d].score ?? 0} indicatorClassName={(a.dimensions[d].score ?? 0) >= 70 ? "bg-success" : (a.dimensions[d].score ?? 0) >= 50 ? "bg-warning" : "bg-destructive"} />
              <span className="num text-right">{a.dimensions[d].score}</span>
            </div>
          ))}
          {a.capped && (
            <p className="mt-1 flex items-start gap-1.5 rounded-md bg-warning/10 px-2 py-1.5 text-2xs">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a.capped}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={<span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Що зроблено правильно</span>}>
          {a.strengths.length ? (
            <ul className="space-y-1 text-xs">
              {a.strengths.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Поки що немає сильних сторін, які можна підтвердити даними.</p>
          )}
        </Section>
        <Section title={<span className="flex items-center gap-1.5"><AlertOctagon className="h-4 w-4 text-destructive" /> Критичні помилки</span>}>
          {a.criticalErrors.length ? (
            <ul className="space-y-1 text-xs">
              {a.criticalErrors.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Критичних помилок немає.</p>
          )}
        </Section>
        <Section title={<span className="flex items-center gap-1.5"><TriangleAlert className="h-4 w-4 text-warning" /> Ризиковані рішення та неточності</span>}>
          {a.risks.length ? (
            <ul className="space-y-1 text-xs">
              {a.risks.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Немає.</p>
          )}
          {a.notes.length > 0 && (
            <ul className="mt-2 space-y-1 border-t pt-2 text-2xs text-muted-foreground">
              {a.notes.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          )}
        </Section>
        <Section title={<span className="flex items-center gap-1.5"><Lightbulb className="h-4 w-4 text-primary" /> Пояснення експерта</span>}>
          <p className="text-xs leading-relaxed">{a.expertExplanation}</p>
          <p className="mt-3 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Альтернативний сценарій</p>
          <p className="text-xs leading-relaxed">{a.alternative}</p>
        </Section>
      </div>
      <Section title="Рекомендовано вивчити">
        <ul className="flex flex-wrap gap-2">
          {a.recommendedArticles.map((slug) => (
            <li key={slug}>
              <Link href={`/knowledge/${slug}`} className="inline-flex rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">
                {getArticle(slug)?.title ?? slug}
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
