"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, FastForward, Loader2, Play } from "lucide-react";
import type { AdAccount } from "@/domain/types";
import { useAppStore, type SimulationSummary } from "@/store/app-store";
import { fmtSimDate } from "@/lib/dates";
import { fmtMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function SimulationBar({ account }: { account: AdAccount }) {
  const simulate = useAppStore((s) => s.simulate);
  const [busy, setBusy] = useState<number | null>(null);
  const [summary, setSummary] = useState<SimulationSummary | null>(null);
  const inReview = account.ads.filter((a) => a.status === "in_review").length;
  const active = account.campaigns.filter((c) => c.status === "active" || c.status === "in_review").length;

  const run = (days: number) => {
    setBusy(days);
    // Відкладаємо обчислення на наступний кадр, щоб показати стан завантаження
    setTimeout(() => {
      try {
        const res = simulate(account.id, days);
        if (res) {
          setSummary(res);
          toast.success(`Симульовано ${days} ${days === 1 ? "день" : "днів"}`, { description: `Витрачено ${fmtMoney(res.spend)} віртуального бюджету.` });
        }
      } catch (e) {
        toast.error("Помилка симуляції", { description: (e as Error).message });
      } finally {
        setBusy(null);
      }
    }, 30);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-surface-sunken/60 px-4 py-2 sm:px-6">
      <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
      <span className="text-xs">
        <span className="text-muted-foreground">Наступний день симуляції: </span>
        <span className="num font-medium">{fmtSimDate(account.startDate, account.simDay, true)}</span>
        <span className="text-muted-foreground"> · день {account.simDay + 1}</span>
      </span>
      {inReview > 0 && <span className="rounded bg-info/10 px-1.5 py-0.5 text-2xs text-info">{inReview} оголош. на перевірці</span>}
      <div className="ml-auto flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" onClick={() => run(1)} disabled={busy !== null || account.readOnly} data-testid="simulate-1">
              {busy === 1 ? <Loader2 className="animate-spin" /> : <Play />} Simulate 1 day
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Спершу завершується перевірка оголошень, потім моделюється аукціон і доставка всіх активних кампаній ({active}). Результат детермінований для однакового стану та seed.
          </TooltipContent>
        </Tooltip>
        <Button size="sm" variant="secondary" onClick={() => run(7)} disabled={busy !== null || account.readOnly} data-testid="simulate-7">
          {busy === 7 ? <Loader2 className="animate-spin" /> : <FastForward />} Simulate 7 days
        </Button>
      </div>

      <Dialog open={summary !== null} onOpenChange={(o) => !o && setSummary(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Підсумок симуляції</DialogTitle>
            <DialogDescription>Навчальні дані, згенеровані моделлю симулятора.</DialogDescription>
          </DialogHeader>
          {summary && (
            <div className="grid gap-3 text-[13px]">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border p-2">
                  <p className="text-2xs text-muted-foreground">Днів</p>
                  <p className="num font-semibold">{summary.days}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-2xs text-muted-foreground">Витрачено</p>
                  <p className="num font-semibold">{fmtMoney(summary.spend)}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-2xs text-muted-foreground">Перевірка оголошень</p>
                  <p className="num font-semibold">
                    <span className="text-success">{summary.reviewed.approved} ✓</span> · <span className="text-destructive">{summary.reviewed.rejected} ✕</span>
                  </p>
                </div>
              </div>
              {summary.spend === 0 && (
                <p className="rounded-md bg-warning/10 px-3 py-2 text-xs">
                  Жодних витрат: немає активних кампаній з активними наборами й схваленими оголошеннями, або набори ще не почались за розкладом.
                </p>
              )}
              {summary.notes.length > 0 && (
                <div>
                  <p className="mb-1 text-2xs font-semibold uppercase text-muted-foreground">Події доставки</p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                    {summary.notes.map((n) => (
                      <li key={n}>• {n}</li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.reviewed.rejected > 0 && <p className="text-xs text-destructive">Є відхилені оголошення — відкрийте вкладку Ads, щоб побачити причини.</p>}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSummary(null)}>Зрозуміло</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
