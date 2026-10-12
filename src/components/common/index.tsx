"use client";

import Link from "next/link";
import { CircleHelp, FlaskConical, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GLOSSARY } from "@/features/metrics/glossary";

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b bg-surface px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-6">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-base font-semibold leading-tight sm:text-lg">{title}</h1>
        {description && <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SimulatedNotice({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs text-foreground", className)} role="note">
      <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" aria-hidden />
      <span>
        <strong className="font-semibold">Навчальні дані.</strong>{" "}
        {compact
          ? "Результати змодельовані симулятором і не є прогнозом реальної ефективності."
          : "Усі показники згенеровано детермінованою навчальною моделлю на основі ваших налаштувань. Це не прогноз реальної ефективності реклами і не дані Meta."}
      </span>
    </div>
  );
}

export function InfoTip({ children, className, label = "Пояснення" }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={cn("inline-flex align-middle text-muted-foreground hover:text-foreground", className)} aria-label={label}>
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">{children}</TooltipContent>
    </Tooltip>
  );
}

export function MetricLabel({ id, children, className }: { id: string; children?: ReactNode; className?: string }) {
  const def = GLOSSARY[id];
  if (!def) return <span className={className}>{children}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn("cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2", className)}>
          {children ?? def.label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs normal-case tracking-normal">
        <p className="font-semibold">{def.label}</p>
        <p className="mt-0.5">{def.definition}</p>
        {def.formula && <p className="mt-1 font-mono text-2xs text-muted-foreground">{def.formula}</p>}
        {def.note && <p className="mt-1 text-2xs text-muted-foreground">{def.note}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon ?? <Inbox className="h-5 w-5" />}</div>
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="max-w-md text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Підтвердити",
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <AlertDialogAction destructive={destructive} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function StatTile({ label, value, hint, metricId, tone, sub }: { label: string; value: ReactNode; hint?: ReactNode; metricId?: string; tone?: "good" | "bad" | "neutral"; sub?: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {metricId ? <MetricLabel id={metricId}>{label}</MetricLabel> : label}
        {hint && <InfoTip>{hint}</InfoTip>}
      </div>
      <div className={cn("num mt-1 text-lg font-semibold leading-tight", tone === "good" && "text-success", tone === "bad" && "text-destructive")}>{value}</div>
      {sub && <div className="mt-0.5 text-2xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function ArticleLink({ slug, children }: { slug: string; children?: ReactNode }) {
  return (
    <Link href={`/knowledge/${slug}`} className="text-primary underline-offset-2 hover:underline">
      {children ?? "Детальніше в базі знань"}
    </Link>
  );
}

export function Section({ title, description, children, actions, className }: { title: ReactNode; description?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-2xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
