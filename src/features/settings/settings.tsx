"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Cloud, Download, HardDrive, LogOut, RefreshCcw, Trash2, Upload } from "lucide-react";
import { useAppStore, STORAGE_KEY, type AppData } from "@/store/app-store";
import { flushStorageNow, storageUsageBytes } from "@/persistence/storage";
import { getCurrentUser, pullSnapshot, pushSnapshot, sendMagicLink, signOut, supabaseConfigured } from "@/persistence/supabase";
import { SANDBOX_ACCOUNT_ID } from "@/content/sandbox";
import { FEATURE_REGISTRY, STATUS_VARIANT } from "@/content/feature-registry";
import { fmtDateTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog, PageHeader, Section } from "@/components/common";

function SupabaseSync() {
  const exportData = useAppStore((s) => s.exportData);
  const importData = useAppStore((s) => s.importData);
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    getCurrentUser()
      .then((u) => setUser(u?.email ?? null))
      .catch(() => setUser(null));
  }, []);

  if (!supabaseConfigured) {
    return (
      <div className="grid gap-2 text-xs">
        <p className="flex items-center gap-2">
          <Badge variant="secondary">Локальний режим</Badge> Supabase не налаштовано — прогрес зберігається лише в цьому браузері.
        </p>
        <p className="text-muted-foreground">
          Щоб увімкнути хмарне збереження, задайте <code>NEXT_PUBLIC_SUPABASE_URL</code> і <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (див. <code>.env.example</code>) та застосуйте міграцію{" "}
          <code>supabase/migrations/0001_app_snapshots.sql</code>.
        </p>
      </div>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error("Помилка синхронізації", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3 text-xs">
      {user ? (
        <>
          <p>
            Увійшли як <b>{user}</b>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() =>
                run(async () => {
                  const at = await pushSnapshot(exportData());
                  toast.success("Збережено в хмарі", { description: fmtDateTime(at) });
                })
              }>
              <Upload /> Зберегти в хмару
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const snap = await pullSnapshot();
                  if (!snap) {
                    toast.info("У хмарі ще немає збереженого прогресу");
                    return;
                  }
                  importData(snap.data);
                  toast.success("Прогрес завантажено з хмари", { description: fmtDateTime(snap.updatedAt) });
                })
              }
            >
              <Download /> Завантажити з хмари
            </Button>
            <Button size="sm" variant="ghost" onClick={() => run(async () => { await signOut(); setUser(null); })}>
              <LogOut /> Вийти
            </Button>
          </div>
        </>
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await sendMagicLink(email);
              toast.success("Посилання для входу надіслано", { description: email });
            });
          }}
        >
          <div className="grid gap-1">
            <Label htmlFor="sb-email">Email для входу (magic link)</Label>
            <Input id="sb-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-64" />
          </div>
          <Button type="submit" size="sm" disabled={busy}>
            <Cloud /> Надіслати посилання
          </Button>
        </form>
      )}
    </div>
  );
}

export function Settings() {
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const accounts = useAppStore((s) => s.accounts);
  const activeId = useAppStore((s) => s.activeAccountId);
  const setActive = useAppStore((s) => s.setActiveAccount);
  const deleteAccount = useAppStore((s) => s.deleteAccount);
  const resetSandbox = useAppStore((s) => s.resetSandbox);
  const resetAll = useAppStore((s) => s.resetAll);
  const exportData = useAppStore((s) => s.exportData);
  const importData = useAppStore((s) => s.importData);
  const [usage, setUsage] = useState(0);
  const [confirm, setConfirm] = useState<null | "sandbox" | "all" | { del: string }>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    flushStorageNow();
    setUsage(storageUsageBytes(STORAGE_KEY));
  }, [accounts]);

  const onExport = () => {
    const blob = new Blob([JSON.stringify(exportData())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adlab-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const onImport = async (f?: File) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as AppData;
      importData(data);
      toast.success("Прогрес імпортовано");
    } catch (e) {
      toast.error("Не вдалося імпортувати", { description: (e as Error).message });
    }
  };

  return (
    <div className="flex flex-col">
      <PageHeader title="Settings" description="Профіль, навчальні акаунти, збереження прогресу та довідка про актуальність даних." />
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2">
        <Section title="Профіль">
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="pf-name">Ім&apos;я в портфоліо</Label>
              <Input id="pf-name" value={profile.displayName} onChange={(e) => setProfile({ displayName: e.target.value.slice(0, 60) || "Студент" })} className="max-w-xs" />
            </div>
            <div className="grid gap-1">
              <Label>Тема інтерфейсу</Label>
              <Select value={profile.theme} onValueChange={(v) => setProfile({ theme: v as typeof profile.theme })}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Як у системі</SelectItem>
                  <SelectItem value="light">Світла</SelectItem>
                  <SelectItem value="dark">Темна</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <Section title="Збереження прогресу">
          <div className="grid gap-3 text-xs">
            <p className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" /> Локально в браузері (localStorage): ~{(usage / 1024).toFixed(0)} КБ
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onExport}>
                <Download /> Експорт JSON
              </Button>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload /> Імпорт JSON
              </Button>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} aria-label="Файл прогресу" />
            </div>
            <div className="border-t pt-3">
              <p className="mb-2 font-semibold">Хмарна синхронізація (Supabase)</p>
              <SupabaseSync />
            </div>
          </div>
        </Section>

        <div className="lg:col-span-2" id="accounts">
          <Section title="Навчальні рекламні акаунти" description="Кожна місія та кейс Error Lab мають окремий акаунт. Видалення акаунта місії не видаляє оцінку в портфоліо.">
            <table className="data-table w-full text-xs">
              <thead>
                <tr>
                  <th scope="col">Акаунт</th>
                  <th scope="col">Тип</th>
                  <th scope="col" className="text-right">Кампаній</th>
                  <th scope="col" className="text-right">Днів</th>
                  <th scope="col" className="text-right">Рядків метрик</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {Object.values(accounts).map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.name} {a.id === activeId && <Badge>активний</Badge>} {a.readOnly && <Badge variant="secondary">лише перегляд</Badge>}
                    </td>
                    <td>{a.kind === "sandbox" ? "Пісочниця" : a.kind === "mission" ? "Місія" : "Error Lab"}</td>
                    <td className="num text-right">{a.campaigns.length}</td>
                    <td className="num text-right">{a.simDay}</td>
                    <td className="num text-right">{a.metrics.length}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        {a.id !== activeId && (
                          <Button size="xs" variant="outline" onClick={() => setActive(a.id)}>
                            Активувати
                          </Button>
                        )}
                        {a.id !== SANDBOX_ACCOUNT_ID && (
                          <Button size="xs" variant="ghost" onClick={() => setConfirm({ del: a.id })} aria-label={`Видалити ${a.name}`}>
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirm("sandbox")}>
                <RefreshCcw /> Скинути пісочницю
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setConfirm("all")}>
                <Trash2 /> Скинути весь прогрес
              </Button>
            </div>
          </Section>
        </div>

        <div className="lg:col-span-2">
          <Section title="Актуальність даних (реєстр функцій)" description="Статуси: Verified, Partially Verified, Needs Review, Deprecated.">
            <div className="overflow-x-auto">
              <table className="data-table w-full text-xs">
                <thead>
                  <tr>
                    <th scope="col">feature_name</th>
                    <th scope="col">supported_objectives</th>
                    <th scope="col">availability_status</th>
                    <th scope="col">region</th>
                    <th scope="col">verified_at</th>
                    <th scope="col">source_url</th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_REGISTRY.map((f) => (
                    <tr key={f.id}>
                      <td className="max-w-[320px] whitespace-normal">{f.feature_name}</td>
                      <td>{f.supported_objectives === "all" ? "all" : f.supported_objectives.join(", ")}</td>
                      <td>
                        <Badge variant={STATUS_VARIANT[f.availability_status]}>{f.availability_status}</Badge>
                      </td>
                      <td>{f.region}</td>
                      <td>{f.verified_at}</td>
                      <td className="max-w-[220px] truncate">
                        <a href={f.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {f.source_url.replace(/^https?:\/\//, "")}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <div className="lg:col-span-2">
          <Section title="Про продукт">
            <p className="text-xs leading-relaxed text-muted-foreground">
              AdLab Simulator — незалежний навчальний тренажер. Він не є продуктом Meta Platforms, Inc., не підключається до справжніх рекламних акаунтів і не відтворює захищені елементи
              інтерфейсу. Усі витрати, покази, аукціони та конверсії — віртуальні й згенеровані детермінованою навчальною моделлю.
            </p>
          </Section>
        </div>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={confirm === "all" ? "Скинути весь прогрес?" : confirm === "sandbox" ? "Скинути пісочницю?" : "Видалити акаунт?"}
        description={
          confirm === "all"
            ? "Буде видалено всі акаунти, спроби місій, результати тестів і портфоліо. Рекомендуємо спершу зробити експорт JSON."
            : confirm === "sandbox"
              ? "Пісочниця повернеться до початкового стану з прикладом кампанії. Ваші кампанії в ній буде видалено."
              : "Акаунт і його дані буде видалено. Оцінка здачі (якщо була) залишиться в портфоліо."
        }
        confirmLabel="Підтвердити"
        onConfirm={() => {
          if (confirm === "all") resetAll();
          else if (confirm === "sandbox") resetSandbox();
          else if (confirm && typeof confirm === "object") deleteAccount(confirm.del);
          toast.success("Готово");
          setConfirm(null);
        }}
      />
    </div>
  );
}
