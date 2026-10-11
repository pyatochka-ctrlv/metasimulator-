"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, CircleUserRound, FlaskConical, Moon, Sun, Wallet } from "lucide-react";
import { useAppStore, useActiveAccount } from "@/store/app-store";
import { fmtMoney } from "@/lib/format";
import { fmtSimDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLevel } from "@/features/learning/progress";

const KIND_LABEL = { sandbox: "Пісочниця", mission: "Місія", error_lab: "Error Lab" } as const;

export function Topbar({ leading }: { leading?: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAppStore((s) => s.hydrated);
  const accounts = useAppStore((s) => s.accounts);
  const setActive = useAppStore((s) => s.setActiveAccount);
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const account = useActiveAccount();
  const level = useLevel();

  const spent = account ? account.metrics.reduce((a, m) => a + m.spend, 0) : 0;
  const balance = account ? account.virtualBudget - spent : 0;
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  return (
    <header className="no-print sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-surface/95 px-2 backdrop-blur sm:px-4">
      {leading}
      {hydrated && account ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 max-w-[52vw] gap-2 px-2 sm:max-w-xs" aria-label="Перемкнути навчальний акаунт">
                <span className="hidden h-6 w-6 shrink-0 items-center justify-center rounded bg-secondary text-2xs font-bold sm:flex">
                  {account.name.slice(0, 1)}
                </span>
                <span className="flex min-w-0 flex-col items-start leading-tight">
                  <span className="max-w-full truncate text-[13px] font-semibold">{account.name}</span>
                  <span className="text-2xs text-muted-foreground">
                    {KIND_LABEL[account.kind]} · ID {account.id.slice(-8)}
                    {account.readOnly ? " · лише перегляд" : ""}
                  </span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80">
              <DropdownMenuLabel>Навчальні рекламні акаунти</DropdownMenuLabel>
              {Object.values(accounts)
                .sort((a, b) => (a.kind === "sandbox" ? -1 : b.kind === "sandbox" ? 1 : b.createdAt.localeCompare(a.createdAt)))
                .map((a) => (
                  <DropdownMenuItem key={a.id} onSelect={() => setActive(a.id)} className="items-start">
                    <span className="mt-0.5 w-4">{a.id === account.id && <Check className="h-4 w-4" />}</span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{a.name}</span>
                      <span className="text-2xs text-muted-foreground">
                        {KIND_LABEL[a.kind]} · {a.campaigns.length} камп. · день {a.simDay}
                        {a.readOnly ? " · завершено" : ""}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/settings#accounts")}>Керувати акаунтами…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="info" className="hidden gap-1 md:inline-flex">
                <FlaskConical className="h-3 w-3" /> Режим симуляції
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              Усі витрати, покази й конверсії — віртуальні навчальні дані. Вони не є прогнозом реальної ефективності реклами.
            </TooltipContent>
          </Tooltip>

          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="hidden flex-col items-end leading-tight sm:flex" tabIndex={0}>
                  <span className="text-2xs text-muted-foreground">Симульована дата</span>
                  <span className="num text-xs font-medium">
                    {account.simDay === 0 ? "ще не почато" : fmtSimDate(account.startDate, account.simDay - 1, true)}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Останній симульований день. Наступна симуляція — {fmtSimDate(account.startDate, account.simDay)}.</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 rounded-md border px-2 py-1" tabIndex={0}>
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <span className="num text-xs font-semibold">{fmtMoney(balance, 0)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Віртуальний баланс: {fmtMoney(account.virtualBudget, 0)} виділено, {fmtMoney(spent)} витрачено в симуляції.
              </TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5" aria-label="Профіль">
                  <CircleUserRound />
                  <span className="hidden text-xs xl:inline">{profile.displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="normal-case">
                  <span className="block text-[13px] font-semibold text-foreground">{profile.displayName}</span>
                  <span className="block font-normal">
                    Рівень: {level.label} · {level.xp} XP
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setProfile({ theme: isDark ? "light" : "dark" })}>
                  {isDark ? <Sun /> : <Moon />} {isDark ? "Світла тема" : "Темна тема"}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/learning">Мій навчальний маршрут</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">Налаштування профілю</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      ) : (
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      )}
    </header>
  );
}
