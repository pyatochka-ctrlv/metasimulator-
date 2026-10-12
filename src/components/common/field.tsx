"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { InfoTip } from "./index";

export function Field({
  label,
  htmlFor,
  hint,
  tip,
  error,
  children,
  className,
  required,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  tip?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
        {tip && <InfoTip>{tip}</InfoTip>}
      </div>
      {children}
      {hint && !error && <p className="text-2xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-2xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormSection({ title, description, children, aside }: { title: ReactNode; description?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <fieldset className="rounded-lg border bg-card">
      <legend className="sr-only">{typeof title === "string" ? title : undefined}</legend>
      <div className="flex items-start justify-between gap-2 border-b px-4 py-2.5">
        <div>
          <h3 className="text-[13px] font-semibold">{title}</h3>
          {description && <p className="text-2xs text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="grid gap-4 p-4">{children}</div>
    </fieldset>
  );
}

export function ChoiceCard({
  selected,
  disabled,
  onSelect,
  title,
  description,
  badge,
  disabledReason,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        selected && "border-primary bg-accent/60 ring-1 ring-primary",
      )}
    >
      <span className="flex w-full items-center justify-between gap-2 text-[13px] font-medium">
        {title}
        {badge}
      </span>
      {description && <span className="text-2xs text-muted-foreground">{description}</span>}
      {disabled && disabledReason && <span className="text-2xs text-warning">{disabledReason}</span>}
    </button>
  );
}
