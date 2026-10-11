"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FlaskConical, Keyboard, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "./nav-items";
import { Topbar } from "./topbar";

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Основна навігація" className="flex flex-col gap-0.5 px-2">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              item.sub && "ml-5 py-1 text-xs",
              active && "bg-accent text-accent-foreground hover:bg-accent",
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", item.sub && "h-3.5 w-3.5")} aria-hidden />
            <span className="truncate">{item.label}</span>
            {item.shortcut && <kbd className="ml-auto hidden text-2xs text-muted-foreground/70 group-hover:inline">Alt+{item.shortcut}</kbd>}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-4 py-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <FlaskConical className="h-4 w-4" aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[13px] font-semibold">AdLab Simulator</span>
        <span className="text-2xs text-muted-foreground">Meta Ads навчальний тренажер · 2026</span>
      </span>
    </Link>
  );
}

function ShellSkeleton() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-label="Завантаження навчального акаунта">
      <Skeleton className="h-6 w-56" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

function useGlobalShortcuts(openHelp: () => void) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable || target.getAttribute("role") === "combobox");
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const item = NAV_ITEMS.find((n) => n.shortcut && e.code === `Digit${n.shortcut}`);
        if (item) {
          e.preventDefault();
          router.push(item.href);
          return;
        }
      }
      if (!typing && e.key === "?" && e.shiftKey) {
        e.preventDefault();
        openHelp();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, openHelp]);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useAppStore((s) => s.hydrated);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  useGlobalShortcuts(() => setHelpOpen(true));

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Перейти до вмісту
      </a>
      <aside className="no-print sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-surface lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto pb-3">
          <SidebarNav />
        </div>
        <div className="border-t p-3">
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => setHelpOpen(true)}>
            <Keyboard /> Гарячі клавіші <kbd className="ml-auto text-2xs">Shift+?</kbd>
          </Button>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0">
          <SheetTitle className="sr-only">Навігація</SheetTitle>
          <Brand />
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          leading={
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Відкрити меню" onClick={() => setMobileOpen(true)}>
              <Menu />
            </Button>
          }
        />
        <main id="main" className="min-w-0 flex-1">
          {hydrated ? children : <ShellSkeleton />}
        </main>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Гарячі клавіші</DialogTitle>
            <DialogDescription>Навігація з клавіатури працює в усіх розділах.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 text-[13px]">
            {NAV_ITEMS.filter((n) => n.shortcut).map((n) => (
              <li key={n.href} className="flex justify-between">
                <span>{n.label}</span>
                <kbd className="rounded border px-1.5 text-2xs">Alt + {n.shortcut}</kbd>
              </li>
            ))}
            <li className="flex justify-between">
              <span>Пошук у таблиці / базі знань</span>
              <kbd className="rounded border px-1.5 text-2xs">/</kbd>
            </li>
            <li className="flex justify-between">
              <span>Ця довідка</span>
              <kbd className="rounded border px-1.5 text-2xs">Shift + ?</kbd>
            </li>
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
