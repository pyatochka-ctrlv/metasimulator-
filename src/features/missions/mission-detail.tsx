"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, BriefcaseBusiness, ClipboardCheck, Play, RotateCcw, Save, Send } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { getMission, MISSION_TYPE_LABEL, PASS_SCORE, type MissionDefinition } from "@/content/missions";
import type { CaseStudy, MissionAnswer, MissionAttempt } from "@/domain/types";
import { userDeliveryDays } from "@/scoring/checks";
import { getArticle } from "@/content/knowledge";
import { fmtDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog, EmptyState, PageHeader, Section, SimulatedNotice } from "@/components/common";
import { Label } from "@/components/ui/label";
import { AssessmentReport, ScoreBadge } from "./assessment-report";
import { LEVEL_LABELS } from "@/features/learning/progress";

const EMPTY_CASE: CaseStudy = { strategy: "", hypotheses: "", testing: "", analysis: "", nextSteps: "", conclusions: "" };

const CASE_FIELDS: { key: keyof CaseStudy; label: string; hint: string }[] = [
  { key: "strategy", label: "Стратегія", hint: "Яку ціль, структуру, аудиторію та креативний підхід обрали і чому." },
  { key: "hypotheses", label: "Гіпотези", hint: "Що очікували отримати і на чому базувались." },
  { key: "testing", label: "Тестування", hint: "Що тестували, як ізолювали змінні, скільки даних зібрали." },
  { key: "analysis", label: "Аналіз результатів", hint: "Ключові метрики з цифрами, що спрацювало, що ні." },
  { key: "nextSteps", label: "Наступні кроки", hint: "Конкретні дії та очікуваний ефект." },
  { key: "conclusions", label: "Висновки", hint: "Головні уроки, обмеження даних (симуляція, атрибуція)." },
];

export function Brief({ mission }: { mission: MissionDefinition }) {
  const b = mission.brief;
  return (
    <Tabs defaultValue="brief">
      <TabsList>
        <TabsTrigger value="brief">Бриф</TabsTrigger>
        <TabsTrigger value="data">Вихідні дані</TabsTrigger>
        <TabsTrigger value="eval">Критерії оцінювання</TabsTrigger>
      </TabsList>
      <TabsContent value="brief" className="pt-3">
        <dl className="grid gap-3 text-xs sm:grid-cols-2">
          {[
            ["Бізнес", b.business],
            ["Продукт", b.product],
            ["Цільова аудиторія", b.audience],
            ["Ціль кампанії", b.goal],
            ["Бюджет", b.budget],
            ["Цінність конверсії / середній чек", b.conversionValue],
            ...(b.margin ? [["Маржинальність", b.margin]] : []),
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 leading-relaxed">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">KPI</p>
            <table className="data-table w-full text-xs">
              <tbody>
                {b.kpis.map((k) => (
                  <tr key={k.label}>
                    <td className="whitespace-normal">{k.label}</td>
                    <td className="whitespace-normal font-medium">{k.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Обмеження</p>
            <ul className="space-y-1 text-xs">
              {b.constraints.map((c) => (
                <li key={c}>• {c}</li>
              ))}
            </ul>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="data" className="pt-3">
        <ul className="space-y-1 text-xs">
          {b.initialData.map((c) => (
            <li key={c}>• {c}</li>
          ))}
        </ul>
        <p className="mt-3 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Що зробити</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs">
          {mission.tasks.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </TabsContent>
      <TabsContent value="eval" className="pt-3">
        <ul className="space-y-1 text-xs">
          {b.evaluation.map((c) => (
            <li key={c}>• {c}</li>
          ))}
        </ul>
        <p className="mt-3 text-2xs text-muted-foreground">
          Оцінка враховує стан кабінету (процес), відповіді, розрахунки й аргументацію. Правильний вибір без обґрунтування зараховується частково; без аргументації максимум — 75 балів; критична помилка
          обмежує результат 69 балами. Прохідний бал — {PASS_SCORE}.
        </p>
      </TabsContent>
    </Tabs>
  );
}

function QuestionField({ q, value, onChange, options }: { q: MissionDefinition["questions"][number]; value: MissionAnswer; onChange: (a: MissionAnswer) => void; options: { id: string; text: string }[] }) {
  const id = `q-${q.id}`;
  return (
    <div className="grid gap-2 rounded-md border p-3">
      <Label htmlFor={id} className="text-[13px] leading-snug">
        {q.prompt}
      </Label>
      {q.hint && <p className="text-2xs text-muted-foreground">{q.hint}</p>}
      {q.kind === "single" && (
        <RadioGroup value={value.selected?.[0] ?? ""} onValueChange={(v) => onChange({ ...value, selected: [v] })} aria-label={q.prompt}>
          {options.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-start gap-2 text-xs">
              <RadioGroupItem value={o.id} className="mt-0.5" /> {o.text}
            </label>
          ))}
        </RadioGroup>
      )}
      {q.kind === "multi" && (
        <div className="grid gap-1.5">
          {options.map((o) => {
            const sel = value.selected ?? [];
            return (
              <label key={o.id} className="flex cursor-pointer items-start gap-2 text-xs">
                <Checkbox checked={sel.includes(o.id)} onCheckedChange={(v) => onChange({ ...value, selected: v ? [...sel, o.id] : sel.filter((x) => x !== o.id) })} className="mt-0.5" />
                {o.text}
              </label>
            );
          })}
        </div>
      )}
      {q.kind === "number" && (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            step="any"
            className="w-40"
            value={value.value ?? ""}
            onChange={(e) => onChange({ ...value, value: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
          {q.unit && <span className="text-xs text-muted-foreground">{q.unit}</span>}
        </div>
      )}
      {q.kind === "text" && <Textarea id={id} rows={4} value={value.text ?? ""} onChange={(e) => onChange({ ...value, text: e.target.value })} placeholder="Посилайтесь на конкретні метрики й налаштування…" />}
      {q.askConfidence && (
        <div className="flex flex-wrap items-center gap-2 text-2xs">
          <span className="text-muted-foreground">Впевненість:</span>
          {([1, 2, 3] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ ...value, confidence: c })}
              className={cn("rounded border px-2 py-0.5", value.confidence === c && "border-primary bg-accent")}
              aria-pressed={value.confidence === c}
            >
              {c === 1 ? "низька" : c === 2 ? "середня" : "висока"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionForm({ mission, attempt }: { mission: MissionDefinition; attempt: MissionAttempt }) {
  const account = useAppStore((s) => s.accounts[attempt.accountId]);
  const save = useAppStore((s) => s.saveMissionDraft);
  const submit = useAppStore((s) => s.submitMission);
  const [answers, setAnswers] = useState<Record<string, MissionAnswer>>(() => Object.fromEntries(attempt.answers.map((a) => [a.questionId, a])));
  const [cs, setCs] = useState<CaseStudy>(attempt.caseStudy ?? EMPTY_CASE);
  const [confirm, setConfirm] = useState(false);
  const days = account ? (mission.type === "build" || mission.id === "m10" ? userDeliveryDays(account) : new Set(account.metrics.filter((m) => m.day >= account.handoverDay && m.impressions > 0).map((m) => m.day)).size) : 0;
  const daysOk = days >= mission.minDeliveryDays;
  const list = mission.questions.map((q) => answers[q.id] ?? { questionId: q.id });
  const unanswered = mission.questions.filter((q) => {
    const a = answers[q.id];
    return !a || (q.kind === "text" ? !a.text?.trim() : q.kind === "number" ? a.value === undefined : !(a.selected?.length));
  }).length;

  useEffect(() => {
    const t = setTimeout(() => save(attempt.id, list, cs), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, cs]);

  if (!account) return <EmptyState title="Акаунт місії не знайдено" description="Можливо, його видалено в налаштуваннях. Почніть місію заново." />;

  return (
    <div className="grid gap-4">
      <Section title="Хід місії" description="Виконайте завдання в кабінеті місії, а потім дайте відповіді.">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-xs">
              Днів доставки{mission.type === "build" ? " ваших кампаній" : " після передачі акаунта"}: <b className="num">{days}</b> / {mission.minDeliveryDays}
            </p>
            <Progress value={mission.minDeliveryDays ? Math.min(100, (days / mission.minDeliveryDays) * 100) : 100} className="mt-1.5 max-w-sm" indicatorClassName={daysOk ? "bg-success" : undefined} />
          </div>
          <Button asChild>
            <Link href="/ads-manager" onClick={() => useAppStore.getState().setActiveAccount(account.id)}>
              <Play /> Відкрити кабінет місії
            </Link>
          </Button>
        </div>
      </Section>

      <Section title="Питання" description={`${mission.questions.length - unanswered} з ${mission.questions.length} відповідей`}>
        <div className="grid gap-3">
          {mission.questions.map((q) => (
            <QuestionField key={q.id} q={q} value={answers[q.id] ?? { questionId: q.id }} onChange={(a) => setAnswers({ ...answers, [q.id]: a })} options={q.optionsFn ? q.optionsFn(account) : (q.options ?? [])} />
          ))}
        </div>
      </Section>

      <Section title="Навчальний кейс" description="Ці поля потраплять у ваше портфоліо. Аргументація враховується в оцінці.">
        <div className="grid gap-3 md:grid-cols-2">
          {CASE_FIELDS.map((f) => (
            <div key={f.key} className="grid gap-1">
              <Label htmlFor={`cs-${f.key}`}>{f.label}</Label>
              <Textarea id={`cs-${f.key}`} rows={3} value={cs[f.key]} onChange={(e) => setCs({ ...cs, [f.key]: e.target.value })} placeholder={f.hint} />
            </div>
          ))}
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {!daysOk && <span className="mr-auto text-2xs text-warning">Ще недостатньо днів доставки — оцінка KPI буде неповною.</span>}
        {unanswered > 0 && <span className="text-2xs text-muted-foreground">Без відповіді: {unanswered}</span>}
        <Button
          variant="outline"
          onClick={() => {
            save(attempt.id, list, cs);
            toast.success("Чернетку збережено");
          }}
        >
          <Save /> Зберегти чернетку
        </Button>
        <Button onClick={() => setConfirm(true)} data-testid="submit-mission">
          <Send /> Здати місію
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Здати місію на оцінювання?"
        description={
          <span>
            Після здачі акаунт місії стане доступним лише для перегляду, а результат збережеться в портфоліо. {!daysOk && "Увага: днів доставки менше за рекомендовані. "}
            {unanswered > 0 && `Без відповіді лишилось ${unanswered} питань.`}
          </span>
        }
        confirmLabel="Здати"
        onConfirm={() => {
          const res = submit(attempt.id, list, cs);
          if (res?.assessment) toast.success(`Оцінка: ${res.assessment.total}/100`, { description: res.assessment.total >= PASS_SCORE ? "Місію зараховано!" : "Перегляньте пояснення і спробуйте ще раз." });
        }}
      />
    </div>
  );
}

export function MissionDetail({ missionId }: { missionId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const mission = getMission(missionId);
  const attempts = useAppStore((s) => s.missionAttempts);
  const start = useAppStore((s) => s.startMission);
  const mine = useMemo(() => Object.values(attempts).filter((a) => a.missionId === missionId).sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [attempts, missionId]);
  const paramAttempt = params.get("attempt");
  const current = (paramAttempt && mine.find((a) => a.id === paramAttempt)) || mine.find((a) => a.status === "in_progress") || mine[0];

  if (!mission) return <EmptyState title="Місію не знайдено" />;

  const begin = () => {
    const id = start(mission.id);
    toast.success("Місію розпочато", { description: "Створено окремий навчальний акаунт місії й зроблено його активним." });
    router.replace(`/missions/${mission.id}?attempt=${id}`);
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow={`Місія ${mission.number} · ${LEVEL_LABELS[mission.level]} · ${MISSION_TYPE_LABEL[mission.type]} · ~${mission.estimatedMinutes} хв`}
        title={mission.title}
        description={mission.summary}
        actions={
          <>
            {current?.status === "submitted" && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/portfolio/case?id=${current.id}`}>
                  <BriefcaseBusiness /> Кейс у портфоліо
                </Link>
              </Button>
            )}
            {(!current || current.status === "submitted") && (
              <Button size="sm" onClick={begin} data-testid="start-mission">
                {current ? <RotateCcw /> : <Play />} {current ? "Повторна спроба" : "Почати місію"}
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[1fr_380px]">
        <div className="grid min-w-0 gap-4">
          <SimulatedNotice compact />
          <section className="rounded-lg border bg-card p-4">
            <Brief mission={mission} />
          </section>
          {current?.status === "in_progress" && <SubmissionForm key={current.id} mission={mission} attempt={current} />}
          {current?.status === "submitted" && current.assessment && (
            <>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardCheck className="h-4 w-4 text-primary" /> Результат спроби від {current.submittedAt ? fmtDateTime(current.submittedAt) : ""}
              </h2>
              <AssessmentReport a={current.assessment} />
            </>
          )}
          {!current && (
            <EmptyState
              title="Місію ще не розпочато"
              description="Після старту буде створено окремий навчальний акаунт з даними сценарію. Пісочниця не зміниться."
              action={
                <Button onClick={begin}>
                  <Play /> Почати місію
                </Button>
              }
            />
          )}
        </div>
        <aside className="grid gap-4 self-start">
          <Section title="Спроби">
            {mine.length === 0 ? (
              <p className="text-xs text-muted-foreground">Ще немає спроб.</p>
            ) : (
              <ul className="grid gap-1.5 text-xs">
                {mine.map((a, i) => (
                  <li key={a.id}>
                    <Link href={`/missions/${mission.id}?attempt=${a.id}`} className={cn("flex items-center justify-between rounded-md border px-2.5 py-1.5 hover:bg-muted", a.id === current?.id && "border-primary")}>
                      <span>
                        Спроба {mine.length - i} · {fmtDateTime(a.startedAt)}
                      </span>
                      {a.assessment ? <ScoreBadge score={a.assessment.total} /> : <Badge variant="info">в процесі</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Корисні матеріали">
            <ul className="grid gap-1 text-xs">
              {mission.recommendedArticles.map((s) => (
                <li key={s}>
                  <Link href={`/knowledge/${s}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <ArrowRight className="h-3 w-3" /> {getArticle(s)?.title ?? s}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </aside>
      </div>
    </div>
  );
}
