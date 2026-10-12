"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BookOpenCheck, CalendarCheck, CheckCircle2, ExternalLink, Search, Target, XCircle } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { ARTICLES, getArticle, KB_CATEGORIES, searchArticles, STATUS_LABEL } from "@/content/knowledge";
import { FEATURE_REGISTRY, STATUS_VARIANT } from "@/content/feature-registry";
import { getMission } from "@/content/missions";
import type { KnowledgeArticle } from "@/domain/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader, Section } from "@/components/common";
import { LEVEL_LABELS } from "@/features/learning/progress";

const STATUS_BADGE: Record<KnowledgeArticle["status"], "success" | "warning" | "destructive" | "secondary"> = {
  verified: "success",
  partially_verified: "warning",
  needs_review: "destructive",
  deprecated: "secondary",
};

export function KnowledgeIndex() {
  const read = useAppStore((s) => s.learning.readArticles);
  const quizzes = useAppStore((s) => s.learning.quizResults);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const results = useMemo(() => searchArticles(q).filter((a) => cat === "all" || a.category === cat), [q, cat]);
  const grouped = KB_CATEGORIES.map((c) => ({ c, items: results.filter((a) => a.category === c) })).filter((g) => g.items.length);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Knowledge Base"
        description="Мінібаза знань українською. Кожна стаття має дату перевірки, джерела та статус актуальності. Функції, що змінюються, звіряйте з реєстром нижче й інтерфейсом свого акаунта."
        actions={
          <span className="text-xs text-muted-foreground">
            Прочитано {read.length} / {ARTICLES.length}
          </span>
        }
      />
      <div className="flex flex-wrap gap-2 border-b bg-surface px-4 py-2 sm:px-6">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук: атрибуція, CAPI, CTR…  ( / )" className="h-8 w-72 pl-7" aria-label="Пошук по базі знань" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="h-8 w-72" aria-label="Категорія">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Усі категорії (22)</SelectItem>
            {KB_CATEGORIES.map((c, i) => (
              <SelectItem key={c} value={c}>
                {i + 1}. {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          {grouped.length === 0 && <EmptyState title="Нічого не знайдено" description="Спробуйте інший запит або категорію." />}
          {grouped.map(({ c, items }) => (
            <section key={c}>
              <h2 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {KB_CATEGORIES.indexOf(c as (typeof KB_CATEGORIES)[number]) + 1}. {c}
              </h2>
              <ul className="grid gap-2 md:grid-cols-2">
                {items.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/knowledge/${a.slug}`} className="flex h-full flex-col gap-1 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/30">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-[13px] font-semibold leading-snug">{a.title}</span>
                        {read.includes(a.slug) && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Прочитано" />}
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{a.summary}</span>
                      <span className="mt-auto flex flex-wrap gap-1 pt-1">
                        <Badge variant="secondary">{LEVEL_LABELS[a.level]}</Badge>
                        <Badge variant={STATUS_BADGE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                        {quizzes[a.slug] && (
                          <Badge variant="outline">
                            тест {quizzes[a.slug].correct}/{quizzes[a.slug].total}
                          </Badge>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <aside className="self-start">
          <Section title="Реєстр функцій 2026" description="Статус перевірки змінних функцій за офіційними джерелами.">
            <ul className="grid gap-2">
              {FEATURE_REGISTRY.map((f) => (
                <li key={f.id} className="rounded-md border p-2 text-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium leading-snug">{f.feature_name}</span>
                    <Badge variant={STATUS_VARIANT[f.availability_status]} className="shrink-0">
                      {f.availability_status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{f.version_notes}</p>
                  <p className="mt-1 flex flex-wrap gap-x-2 text-muted-foreground">
                    <span>Регіон: {f.region}</span>
                    <span>Перевірено: {f.verified_at}</span>
                    <a href={f.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                      джерело <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        </aside>
      </div>
    </div>
  );
}

function Quiz({ article }: { article: KnowledgeArticle }) {
  const save = useAppStore((s) => s.saveQuizResult);
  const markRead = useAppStore((s) => s.markArticleRead);
  const prev = useAppStore((s) => s.learning.quizResults[article.slug]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const correct = article.quiz.filter((q) => answers[q.id] === q.correct).length;
  return (
    <Section title="Мінітест" description={prev ? `Попередній результат: ${prev.correct}/${prev.total}` : "Перевірте розуміння — результат зберігається в навчальному прогресі."}>
      <ol className="grid gap-4">
        {article.quiz.map((q, i) => (
          <li key={q.id}>
            <p className="mb-1.5 text-[13px] font-medium">
              {i + 1}. {q.question}
            </p>
            <div className="grid gap-1" role="radiogroup" aria-label={q.question}>
              {q.options.map((o) => {
                const selected = answers[q.id] === o.id;
                const isRight = checked && o.id === q.correct;
                const isWrong = checked && selected && o.id !== q.correct;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={checked}
                    onClick={() => setAnswers({ ...answers, [q.id]: o.id })}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted disabled:cursor-default",
                      selected && !checked && "border-primary bg-accent/50",
                      isRight && "border-success bg-success/10",
                      isWrong && "border-destructive bg-destructive/10",
                    )}
                  >
                    {isRight ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : isWrong ? <XCircle className="h-3.5 w-3.5 text-destructive" /> : <span className="h-3.5 w-3.5 rounded-full border" />}
                    {o.text}
                  </button>
                );
              })}
            </div>
            {checked && <p className="mt-1 text-2xs text-muted-foreground">{q.explanation}</p>}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center gap-2">
        {!checked ? (
          <Button
            size="sm"
            disabled={Object.keys(answers).length < article.quiz.length}
            onClick={() => {
              setChecked(true);
              save({ articleSlug: article.slug, correct, total: article.quiz.length, at: new Date().toISOString() });
              markRead(article.slug);
              toast.success(`Результат: ${correct}/${article.quiz.length}`);
            }}
          >
            Перевірити
          </Button>
        ) : (
          <>
            <span className="text-xs">
              Правильно: <b>{correct}</b> з {article.quiz.length}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAnswers({});
                setChecked(false);
              }}
            >
              Пройти ще раз
            </Button>
          </>
        )}
      </div>
    </Section>
  );
}

export function ArticleView({ slug }: { slug: string }) {
  const a = getArticle(slug);
  const read = useAppStore((s) => s.learning.readArticles.includes(slug));
  const markRead = useAppStore((s) => s.markArticleRead);
  if (!a) return <EmptyState title="Статтю не знайдено" action={<Button asChild><Link href="/knowledge">До бази знань</Link></Button>} />;
  const features = (a.featureIds ?? []).map((id) => FEATURE_REGISTRY.find((f) => f.id === id)).filter(Boolean) as (typeof FEATURE_REGISTRY)[number][];
  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow={`${a.category} · ${LEVEL_LABELS[a.level]}`}
        title={a.title}
        description={a.summary}
        actions={
          <Button size="sm" variant={read ? "outline" : "default"} onClick={() => markRead(a.slug)} disabled={read}>
            <BookOpenCheck /> {read ? "Прочитано" : "Позначити прочитаним"}
          </Button>
        }
      />
      <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[1fr_320px]">
        <article className="grid min-w-0 gap-4">
          <Section title="Визначення">
            <p className="text-[13px] leading-relaxed">{a.definition}</p>
          </Section>
          <Section title="Пояснення">
            <div className="prose-kb text-[13px]">
              {a.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </Section>
          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Практичний приклад">
              <p className="text-[13px] leading-relaxed">{a.example}</p>
            </Section>
            <Section title="Коли застосовувати">
              <ul className="space-y-1 text-[13px]">
                {a.whenToUse.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            </Section>
          </div>
          <Section title="Типові помилки">
            <ul className="space-y-1 text-[13px]">
              {a.mistakes.map((w) => (
                <li key={w} className="flex gap-2">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" /> {w}
                </li>
              ))}
            </ul>
          </Section>
          <Quiz article={a} />
        </article>
        <aside className="grid gap-4 self-start">
          <Section title="Актуальність">
            <dl className="grid gap-2 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Статус</dt>
                <dd>
                  <Badge variant={STATUS_BADGE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <CalendarCheck className="h-3.5 w-3.5" /> Остання перевірка
                </dt>
                <dd>{a.lastReviewed}</dd>
              </div>
            </dl>
            <p className="mt-2 text-2xs text-muted-foreground">
              Інтерфейс і доступність функцій можуть відрізнятися між акаунтами, країнами та типами кампаній через поступове розгортання оновлень.
            </p>
            {features.length > 0 && (
              <ul className="mt-3 grid gap-1.5 border-t pt-2">
                {features.map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-2 text-2xs">
                    <span>{f.feature_name}</span>
                    <Badge variant={STATUS_VARIANT[f.availability_status]} className="shrink-0">
                      {f.availability_status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Джерела">
            <ul className="grid gap-2 text-xs">
              {a.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-primary hover:underline">
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" /> {s.title}
                  </a>
                  <span className="block text-2xs text-muted-foreground">{s.publisher}</span>
                </li>
              ))}
            </ul>
          </Section>
          {a.missionIds.length > 0 && (
            <Section title="Практика">
              <ul className="grid gap-1.5 text-xs">
                {a.missionIds.map((id) => {
                  const m = getMission(id);
                  return m ? (
                    <li key={id}>
                      <Link href={`/missions/${id}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                        <Target className="h-3.5 w-3.5" /> Місія {m.number}: {m.title}
                      </Link>
                    </li>
                  ) : null;
                })}
              </ul>
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}
