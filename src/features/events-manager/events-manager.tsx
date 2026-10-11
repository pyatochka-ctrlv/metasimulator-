"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, Radar, Server, ShieldCheck } from "lucide-react";
import { useActiveAccount, useAppStore } from "@/store/app-store";
import { updateTracking } from "@/domain/operations";
import { PIXEL_EVENTS } from "@/domain/catalog";
import type { PixelEvent, TrackingSetup } from "@/domain/types";
import { captureModel, consentFactor } from "@/simulation/tracking";
import { fmtInt, fmtPct } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArticleLink, InfoTip, PageHeader, Section, SimulatedNotice } from "@/components/common";

const EMQ_PRESETS = [
  { value: 4, label: "Лише IP і user agent (EMQ ≈ 4)" },
  { value: 6, label: "+ хешований email (EMQ ≈ 6)" },
  { value: 8, label: "+ телефон, fbp/fbc, external_id (EMQ ≈ 8)" },
];

export function EventsManager() {
  const account = useActiveAccount();
  const mutate = useAppStore((s) => s.mutateAccount);

  const recent = useMemo(() => {
    if (!account) return null;
    const from = Math.max(0, account.simDay - 7);
    const rows = account.metrics.filter((m) => m.day >= from);
    const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
    return {
      sessions: sum((r) => r.sessions),
      lpv: sum((r) => r.landingPageViews),
      leadsTrue: sum((r) => r.trueLeads),
      purchasesTrue: sum((r) => r.truePurchases),
    };
  }, [account]);

  if (!account || !recent) return null;
  const t = account.tracking;
  const readOnly = Boolean(account.readOnly);
  const set = (patch: Partial<TrackingSetup>, msg: string) => {
    mutate(account.id, (a) => updateTracking(a, patch));
    toast.success(msg);
  };

  const eventRows: { ev: PixelEvent; trueCount: number }[] = [
    { ev: "PageView", trueCount: recent.sessions },
    { ev: "Lead", trueCount: recent.leadsTrue },
    { ev: "Purchase", trueCount: recent.purchasesTrue },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Events Manager"
        description={`Датасет ${t.pixel.id} · домен ${account.landingPage.domain}`}
        eyebrow={
          <span className="flex items-center gap-1">
            <Radar className="h-3 w-3" /> Навчальний трекінг
          </span>
        }
      />
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <SimulatedNotice compact />
          {readOnly && <p className="mt-2 text-xs text-warning">Акаунт лише для перегляду — налаштування не змінюються.</p>}
        </div>

        <Section title="Meta Pixel (браузер)" description="Код на сайті, що надсилає події з браузера відвідувача." actions={<Badge variant={t.pixel.installed ? "success" : "destructive"}>{t.pixel.installed ? "Встановлено" : "Не встановлено"}</Badge>}>
          <fieldset disabled={readOnly} className="grid gap-3">
            <label className="flex items-center gap-2 text-[13px]">
              <Switch checked={t.pixel.installed} onCheckedChange={(v) => set({ pixel: { ...t.pixel, installed: v } }, v ? "Pixel встановлено" : "Pixel вимкнено")} aria-label="Pixel встановлено" /> Pixel встановлено на сайті
            </label>
            <div>
              <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Події, що спрацьовують на сайті</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {PIXEL_EVENTS.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-[13px]">
                    <Checkbox
                      checked={t.pixel.events.includes(e.id)}
                      onCheckedChange={(v) => set({ pixel: { ...t.pixel, events: v ? [...t.pixel.events, e.id] : t.pixel.events.filter((x) => x !== e.id) } }, `Подію ${e.id} ${v ? "додано" : "прибрано"}`)}
                    />
                    {e.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-start gap-2 text-[13px]">
              <Switch checked={t.pixel.duplicateBrowserEvents} onCheckedChange={(v) => set({ pixel: { ...t.pixel, duplicateBrowserEvents: v } }, v ? "Увімкнено дубль подій (навчальна помилка)" : "Дубль браузерних подій прибрано")} aria-label="Дубль браузерних подій" />
              <span>
                Код Pixel встановлено двічі (дубль браузерних подій)
                <span className="block text-2xs text-muted-foreground">Типова помилка: Pixel у темі сайту + у тег-менеджері. Дедуплікація не діє всередині одного джерела.</span>
              </span>
            </label>
          </fieldset>
        </Section>

        <Section title="Conversions API (сервер)" description="Сервер бізнесу надсилає події напряму — менше втрат через блокувальники і браузери." actions={<Badge variant={t.capi.enabled ? "success" : "secondary"}>{t.capi.enabled ? "Підключено" : "Не підключено"}</Badge>}>
          <fieldset disabled={readOnly} className="grid gap-3">
            <label className="flex items-center gap-2 text-[13px]">
              <Switch checked={t.capi.enabled} onCheckedChange={(v) => set({ capi: { ...t.capi, enabled: v } }, v ? "CAPI підключено" : "CAPI вимкнено")} aria-label="Conversions API" /> Надсилати події через Conversions API
            </label>
            <label className="flex items-start gap-2 text-[13px]">
              <Switch checked={t.capi.sendsEventId} disabled={!t.capi.enabled} onCheckedChange={(v) => set({ capi: { ...t.capi, sendsEventId: v } }, v ? "Дедуплікацію налаштовано" : "Дедуплікацію вимкнено")} aria-label="Передавати event_id" />
              <span>
                Передавати однакові <code className="text-xs">event_id</code> та <code className="text-xs">event_name</code> з браузера і сервера
                <span className="block text-2xs text-muted-foreground">Без цього подія з Pixel і з CAPI рахується двічі. Дедуплікація працює в межах 48 годин.</span>
              </span>
            </label>
            <div className="grid gap-1.5">
              <span className="flex items-center gap-1 text-xs font-medium">
                Параметри клієнта (advanced matching){" "}
                <InfoTip>Чим більше коректних хешованих параметрів (email, телефон, external_id, fbp/fbc), тим краще події зіставляються з людьми — вища Event Match Quality.</InfoTip>
              </span>
              <Select value={String(EMQ_PRESETS.reduce((best, p) => (Math.abs(p.value - t.capi.eventMatchQuality) < Math.abs(best.value - t.capi.eventMatchQuality) ? p : best)).value)} onValueChange={(v) => set({ capi: { ...t.capi, eventMatchQuality: Number(v) } }, "Параметри зіставлення оновлено")} disabled={!t.capi.enabled}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMQ_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={String(p.value)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-2xs text-muted-foreground">Event Match Quality: {t.capi.enabled ? `${t.capi.eventMatchQuality}/10` : "—"}</span>
            </div>
          </fieldset>
        </Section>

        <Section title="Згода та приватність" description="Для трафіку з ЄС потрібна згода на маркетингові cookie.">
          <fieldset disabled={readOnly} className="grid gap-3">
            <label className="flex items-start gap-2 text-[13px]">
              <Switch checked={t.consent.bannerEnabled} onCheckedChange={(v) => set({ consent: { ...t.consent, bannerEnabled: v } }, v ? "Банер згоди увімкнено" : "Банер згоди вимкнено")} aria-label="Банер згоди" />
              <span>
                Банер згоди (CMP) на сайті
                <span className="block text-2xs text-muted-foreground">Pixel і CAPI надсилають маркетингові події лише за наявності згоди. У симуляторі частка згоди ≈ {fmtPct(t.consent.acceptRate * 100, 0)}.</span>
              </span>
            </label>
            <p className="flex items-start gap-1.5 rounded-md bg-muted px-3 py-2 text-2xs">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Згода зменшує кількість зафіксованих подій, але це законна вимога, а не «проблема». Компенсуйте її якістю даних (CAPI, advanced matching), а не обходом. <ArticleLink slug="privacy-consent">Приватність і згода</ArticleLink>
            </p>
            <label className="flex items-center gap-2 text-[13px]">
              <Switch checked={t.domainVerified} onCheckedChange={(v) => set({ domainVerified: v }, "Статус домену оновлено")} aria-label="Домен підтверджено" /> Домен підтверджено в business portfolio
            </label>
          </fieldset>
        </Section>

        <Section title="CRM та застосунок">
          <fieldset disabled={readOnly} className="grid gap-3">
            <label className="flex items-center gap-2 text-[13px]">
              <Switch checked={t.crmConnected} onCheckedChange={(v) => set({ crmConnected: v }, "Інтеграцію CRM оновлено")} aria-label="CRM підключено" /> Ліди з миттєвих форм автоматично надходять у CRM
            </label>
            <label className="flex items-start gap-2 text-[13px]">
              <Switch checked={t.crmFeedback} onCheckedChange={(v) => set({ crmFeedback: v }, v ? "Статуси лідів передаються з CRM" : "Передачу статусів вимкнено")} aria-label="Передача статусів з CRM" />
              <span>
                Передавати статуси лідів з CRM назад (кваліфікований / продаж)
                <span className="block text-2xs text-muted-foreground">Потрібно для оптимізації на conversion leads.</span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <Switch checked={t.appRegistered} onCheckedChange={(v) => set({ appRegistered: v }, "Статус застосунку оновлено")} aria-label="Застосунок зареєстровано" /> Застосунок зареєстровано (SDK)
            </label>
          </fieldset>
        </Section>

        <div className="lg:col-span-2">
          <Section title="Огляд подій за 7 днів" description="Скільки реальних дій сталося на сайті і скільки потрапило в датасет за поточних налаштувань.">
            <div className="overflow-x-auto">
              <table className="data-table w-full text-xs">
                <thead>
                  <tr>
                    <th>Подія</th>
                    <th className="text-right">Реальні дії (бекенд)</th>
                    <th className="text-right">Браузер</th>
                    <th className="text-right">Сервер</th>
                    <th className="text-right">Отримано після дедуплікації</th>
                    <th className="text-right">Покриття</th>
                    <th>Стан</th>
                  </tr>
                </thead>
                <tbody>
                  {eventRows.map(({ ev, trueCount }) => {
                    const c = captureModel(account, ev);
                    const received = Math.round(trueCount * c.capture);
                    const coverage = trueCount ? c.capture * 100 : null;
                    const ok = c.capture > 0 && !c.duplicated && c.capture <= 1.05;
                    return (
                      <tr key={ev}>
                        <td className="font-mono">{ev}</td>
                        <td className="num text-right">{fmtInt(trueCount)}</td>
                        <td className="num text-right">{fmtInt(trueCount * c.browser)}</td>
                        <td className="num text-right">{fmtInt(trueCount * c.server)}</td>
                        <td className="num text-right">{fmtInt(received)}</td>
                        <td className="num text-right">{fmtPct(coverage, 0)}</td>
                        <td>
                          {ok ? (
                            <span className="inline-flex items-center gap-1 text-success">
                              <CheckCircle2 className="h-3.5 w-3.5" /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <CircleAlert className="h-3.5 w-3.5" />
                              {c.capture === 0 ? "Не надходить" : "Дублювання"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="mt-2 space-y-0.5 text-2xs text-muted-foreground">
              <li>
                • Частка відвідувачів з дозволеним трекінгом: {fmtPct(consentFactor(account) * 100, 0)}. Браузерні втрати (блокувальники, обмеження браузерів) у моделі ≈ 20%.
              </li>
              <li>• Покриття понад 100% означає подвійний облік — звіти та ROAS завищені, а оптимізація отримує спотворений сигнал.</li>
              <li className="flex items-center gap-1">
                <Server className="h-3 w-3" /> <ArticleLink slug="pixel-capi">Pixel та Conversions API</ArticleLink> · <ArticleLink slug="events-manager">Events Manager</ArticleLink>
              </li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
