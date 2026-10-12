"use client";

import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/store/app-store";
import { onStorageError } from "@/persistence/storage";

function StoreHydrator() {
  useEffect(() => {
    void useAppStore.persist.rehydrate();
    const off = onStorageError((e) => {
      toast.error("Не вдалося зберегти прогрес у браузері", {
        description: e.name === "QuotaExceededError" ? "Сховище переповнене. Видаліть старі акаунти місій у Налаштуваннях." : e.message,
      });
    });
    return () => {
      off();
    };
  }, []);
  return null;
}

function ThemeSync() {
  const theme = useAppStore((s) => s.profile.theme);
  const hydrated = useAppStore((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("adlab-theme", theme);
    } catch {
      /* ignore */
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, hydrated]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={250}>
      <StoreHydrator />
      <ThemeSync />
      {children}
      <Toaster position="top-center" offset={60} richColors closeButton toastOptions={{ className: "text-[13px]" }} />
    </TooltipProvider>
  );
}
