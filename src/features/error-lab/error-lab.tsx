"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bug, CheckCircle2, ClipboardList, ExternalLink, Microscope, XCircle } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { ERROR_LAB_CASES, getErrorLabCase } from "@/content/error-lab";
import { getArticle } from "@/content/knowledge";
import type { ErrorLabAttempt } from "@/domain/types";
import { evaluateErrorLab } from "@/scoring/evaluate-error-lab";
import { fmtDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmptyState, PageHeader, Section, SimulatedNotice } from "@/components/common";
import { LEVEL_LABELS } from "@/features/learning/progress";

export function ErrorLabIndex() {
  const attempts = useAppStore((s) => s.errorLabAttempts);
  const best = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of Object.values(attempts)) m[a.caseId] = Math.max(m[a.caseId] ?? 0, a.score);
    return m;
  }, [attempts]);
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Error Lab"
        description="Навмисно проблемні рекламні акаунти. Вивчіть симптоми та дані в кабінеті, сформулюйте діагноз із доказами та рівнем впевненості."
      />
      <div className="grid gap-3 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
        {ERROR_LAB_CASES.map((c, i) => (
          <Link key={c.id} href={`/error-lab/${c.id}`} className="flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30">
            <span className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Bug className="h-3.5 w-3.5" /> Кейс {i + 1}
              </span>
              {best[c.id] !== undefined && <Badge variant={best[c.id] >= 70 ? "success" : "warning"}>{best[c.id]}/100</Badge>}
            </span>
            <span className="text-[13px] font-semibold">{c.title}</span>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {c.symptoms.slice(0, 2).map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
            <Badge variant="secondary" className="mt-auto w-fit">
              {LEVEL_LABELS[c.level]}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ErrorLabCaseView({ caseId }: { caseId: string }) {
  const router = useRouter();
  const c = getErrorLabCase(caseId);
  const open = useAppStore((s) => s.openErrorLabCase);
  const submit = useAppStore((s) => s.submitErrorLab);
  const attempts = useAppStore((s) => s.errorLabAttempts);
  const mine = Object.values(attempts)
    .filter((a) => a.caseId === caseId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const [causes, setCauses] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<1 | 2 | 3>(2);
  const [explanation, setExplanation] = useState("");
  const [result, setResult] = useState<ErrorLabAttempt | null>(null);

  if (!c) return <EmptyState title="Кейс не знайдено" />;
  const detail = result ? evaluateErrorLab(c, result.selectedCauses, result.checkedEvidence, result.confidence, result.explanation) : null;

  const openAccount = () => {
    open(c.id);
    router.push("/ads-manager");
  };

  const onSubmit = () => {
    const accountId = `acc_lab_${c.id}`;
    const att = submit({ caseId: c.id, accountId, selectedCauses: causes, checkedEvidence: evidence, confidence, explanation });
    if (att) {
      setResult(att);
      toast.success(`Діагноз оцінено: ${att.score}/100`);
    }
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow={`Error Lab · ${LEVEL_LABELS[c.level]}`}
        title={c.title}
        description={c.context}
        actions={
          <Button size="sm" onClick={openAccount} data-testid="open-lab-account">
            <Microscope /> Дослідити акаунт
          </Button>
        }
      />
      <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[1fr_360px]">
        <div className="grid min-w-0 gap-4">
          <SimulatedNotice compact />
          <Section title="Симптоми">
            <ul className="space-y-1 text-[13px]">
              {c.symptoms.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
            <p className="mt-3 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Де шукати</p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {c.whereToLook.map((s) => (
                <li key={s}>→ {s}</li>
              ))}
            </ul>
          </Section>

          {!result ? (
            <Section title="Ваш діагноз" description="Оберіть причини й докази, що їх підтверджують. Хибні варіанти знижують бал — не обирайте «про всяк випадок».">
              <div className="grid gap-4">
                <fieldset>
                  <legend className="mb-1.5 text-xs font-semibold">Причини</legend>
                  <div className="grid gap-1.5">
                    {c.causes.map((x) => (
                      <label key={x.id} className="flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs hover:bg-muted/50">
                        <Checkbox checked={causes.includes(x.id)} onCheckedChange={(v) => setCauses(v ? [...causes, x.id] : causes.filter((y) => y !== x.id))} className="mt-0.5" />
                        {x.text}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-1.5 text-xs font-semibold">Докази з даних</legend>
                  <div className="grid gap-1.5">
                    {c.evidence.map((x) => (
                      <label key={x.id} className="flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs hover:bg-muted/50">
                        <Checkbox checked={evidence.includes(x.id)} onCheckedChange={(v) => setEvidence(v ? [...evidence, x.id] : evidence.filter((y) => y !== x.id))} className="mt-0.5" />
                        {x.text}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <p className="mb-1.5 text-xs font-semibold">Наскільки ви впевнені?</p>
                  <div className="flex gap-2" role="radiogroup" aria-label="Впевненість">
                    {([1, 2, 3] as const).map((v) => (
                      <button key={v} type="button" role="radio" aria-checked={confidence === v} onClick={() => setConfidence(v)} className={cn("rounded-md border px-3 py-1.5 text-xs", confidence === v && "border-primary bg-accent")}>
                        {v === 1 ? "Низька" : v === 2 ? "Середня" : "Висока"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="lab-expl">Пояснення: чому саме ці причини і що перевірите далі</Label>
                  <Textarea id="lab-expl" rows={4} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Наведіть конкретні цифри з кабінету і логіку зв'язку причина → симптом" />
                </div>
                <div className="flex justify-end">
                  <Button onClick={onSubmit} disabled={causes.length === 0} data-testid="submit-diagnosis">
                    <ClipboardList /> Надіслати діагноз
                  </Button>
                </div>
              </div>
            </Section>
          ) : (
            detail && (
              <Section title={`Результат: ${result.score}/100`} description={detail.calibration}>
                <div className="grid gap-4 text-xs">
                  <div>
                    <p className="mb-1 font-semibold">Розбір причин</p>
                    <ul className="grid gap-1.5">
                      {c.causes.map((x) => {
                        const chosen = result.selectedCauses.includes(x.id);
                        return (
                          <li key={x.id} className={cn("flex gap-2 rounded-md border px-2.5 py-2", x.correct ? "border-success/40" : chosen ? "border-destructive/40" : "")}>
                            {x.correct ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                            <span>
                              <span className="font-medium">{x.text}</span> {chosen ? <Badge variant={x.correct ? "success" : "destructive"}>{x.correct ? "ви обрали ✓" : "хибно обрано"}</Badge> : x.correct ? <Badge variant="warning">пропущено</Badge> : null}
                              <span className="block text-muted-foreground">{x.explanation}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1 font-semibold">Рівень впевненості діагнозу на цих даних: {c.diagnosticConfidence.level}</p>
                      <p className="text-muted-foreground">{c.diagnosticConfidence.reason}</p>
                    </div>
                    <div>
                      <p className="mb-1 font-semibold">Список перевірок</p>
                      <ol className="list-decimal space-y-0.5 pl-4">
                        {c.checks.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 font-semibold">Пояснення</p>
                    <p className="leading-relaxed">{c.explanation}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {c.articleSlugs.map((s) => (
                      <Link key={s} href={`/knowledge/${s}`} className="rounded-md border px-2.5 py-1.5 hover:bg-muted">
                        {getArticle(s)?.title ?? s}
                      </Link>
                    ))}
                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => setResult(null)}>
                      Спробувати ще раз
                    </Button>
                  </div>
                </div>
              </Section>
            )
          )}
        </div>
        <aside className="grid gap-4 self-start">
          <Section title="Як досліджувати">
            <ol className="list-decimal space-y-1 pl-4 text-xs">
              <li>Натисніть «Дослідити акаунт» — він відкриється в Ads Manager (лише перегляд).</li>
              <li>Перегляньте налаштування кампаній, наборів, оголошень і Events Manager.</li>
              <li>В Analytics подивіться воронку, breakdown і вкладку «Діагностика».</li>
              <li>Перевірте журнал змін.</li>
              <li>Поверніться сюди й сформулюйте діагноз.</li>
            </ol>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={openAccount}>
              <ExternalLink /> Відкрити акаунт кейсу
            </Button>
          </Section>
          <Section title="Ваші спроби">
            {mine.length === 0 ? (
              <p className="text-xs text-muted-foreground">Ще немає.</p>
            ) : (
              <ul className="grid gap-1 text-xs">
                {mine.map((a) => (
                  <li key={a.id} className="flex justify-between">
                    <span>{fmtDateTime(a.submittedAt)}</span>
                    <Badge variant={a.score >= 70 ? "success" : "warning"}>{a.score}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
}
