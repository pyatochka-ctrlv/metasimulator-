"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { COUNTRIES, INTERESTS, LANGUAGES, countryByCode } from "@/domain/catalog";
import type { AdAccount, AudienceTargeting, CountryCode } from "@/domain/types";
import type { SpecialCategoryRules } from "@/domain/objective-config";
import { estimateAudience } from "@/simulation/audience";
import { fmtCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormSection } from "@/components/common/field";
import { ArticleLink, InfoTip } from "@/components/common";

const AGES = Array.from({ length: 48 }, (_, i) => 18 + i);

const AUDIENCE_TYPE_LABEL: Record<string, string> = {
  custom_website: "Сайт",
  custom_customer_list: "Список клієнтів",
  custom_engagement: "Взаємодія",
  custom_lead_form: "Лід-форма",
  custom_video: "Відео",
  lookalike: "Lookalike",
};

function MultiPicker({
  label,
  options,
  value,
  onChange,
  disabledIds = [],
  placeholder = "Пошук…",
}: {
  label: string;
  options: { id: string; label: string; group?: string; meta?: string; badge?: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  disabledIds?: string[];
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {value.map((id) => {
          const o = options.find((x) => x.id === id);
          return (
            <Badge key={id} variant="secondary" className="gap-1 pr-0.5">
              {o?.label ?? id}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={`Прибрати ${o?.label ?? id}`} className="rounded p-0.5 hover:bg-muted">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-fit">
            <Plus /> {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-7" aria-label={placeholder} />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && <p className="p-2 text-xs text-muted-foreground">Нічого не знайдено</p>}
            {filtered.map((o) => {
              const disabled = disabledIds.includes(o.id);
              return (
                <label key={o.id} className={cn("flex cursor-pointer items-start gap-2 rounded px-1.5 py-1.5 hover:bg-muted", disabled && "cursor-not-allowed opacity-50")}>
                  <Checkbox
                    disabled={disabled}
                    checked={value.includes(o.id)}
                    onCheckedChange={(v) => onChange(v ? [...value, o.id] : value.filter((x) => x !== o.id))}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px]">
                      {o.label} {o.badge && <Badge variant="warning">{o.badge}</Badge>}
                    </span>
                    {(o.group || o.meta) && <span className="block text-2xs text-muted-foreground">{[o.group, o.meta].filter(Boolean).join(" · ")}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function LocationsEditor({ value, onChange, minRadius }: { value: AudienceTargeting["locations"]; onChange: (v: AudienceTargeting["locations"]) => void; minRadius: number }) {
  const [country, setCountry] = useState<CountryCode>("UA");
  const [city, setCity] = useState<string>("");
  const cities = countryByCode(country).cities;
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {value.map((l, i) => (
          <li key={`${l.country}-${l.city ?? ""}-${i}`} className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-[13px]">
            <span className="font-medium">{countryByCode(l.country).name}</span>
            {l.city && (
              <>
                <span className="text-muted-foreground">· {l.city}</span>
                <span className="flex items-center gap-1 text-xs">
                  радіус
                  <Input
                    type="number"
                    min={minRadius}
                    max={80}
                    value={l.radiusKm ?? 10}
                    onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, radiusKm: Math.max(1, Math.min(80, Number(e.target.value) || 1)) } : x)))}
                    className="h-6 w-16 px-1.5 text-xs"
                    aria-label={`Радіус навколо ${l.city}, км`}
                  />
                  км
                </span>
              </>
            )}
            <Button type="button" variant="ghost" size="icon-sm" className="ml-auto h-6 w-6" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Прибрати локацію">
              <X className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <Select value={country} onValueChange={(v) => { setCountry(v as CountryCode); setCity(""); }}>
          <SelectTrigger className="w-40" aria-label="Країна">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={city || "__all"} onValueChange={(v) => setCity(v === "__all" ? "" : v)}>
          <SelectTrigger className="w-44" aria-label="Місто">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Уся країна</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.name} (+ радіус)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const exists = value.some((l) => l.country === country && (l.city ?? "") === city);
            if (!exists) onChange([...value, city ? { country, city, radiusKm: Math.max(minRadius, 10) } : { country }]);
          }}
        >
          <Plus /> Додати локацію
        </Button>
      </div>
    </div>
  );
}

export function AudienceEditor({
  account,
  value,
  onChange,
  rules,
  error,
}: {
  account: AdAccount;
  value: AudienceTargeting;
  onChange: (v: AudienceTargeting) => void;
  rules: SpecialCategoryRules;
  error?: string;
}) {
  const set = (patch: Partial<AudienceTargeting>) => onChange({ ...value, ...patch });
  const estimate = useMemo(() => estimateAudience(account, value), [account, value]);
  const adv = value.advantageAudience;
  const audienceOptions = account.audiences.map((a) => ({
    id: a.id,
    label: a.name,
    group: AUDIENCE_TYPE_LABEL[a.type],
    meta: `~${fmtCompact(a.size)} осіб`,
    badge: a.flaggedSensitive ? "чутлива" : undefined,
  }));
  const lookalikeIds = account.audiences.filter((a) => a.type === "lookalike").map((a) => a.id);
  const interestOptions = INTERESTS.filter((i) => !(i.sensitive && rules.active)).map((i) => ({
    id: i.id,
    label: i.name,
    group: i.category,
    meta: `${Math.round(i.share * 100)}% аудиторії`,
    badge: i.sensitive ? "чутливий" : undefined,
  }));
  const breadthPct = Math.min(100, Math.max(4, (Math.log10(Math.max(1000, estimate.size)) - 3) * 22));

  return (
    <FormSection
      title="Аудиторія"
      description="Кому показувати рекламу."
      aside={
        <div className="text-right">
          <div className="text-2xs text-muted-foreground">Оцінка потенційної аудиторії</div>
          <div className="num text-[13px] font-semibold">
            {fmtCompact(estimate.lower)} – {fmtCompact(estimate.upper)}
          </div>
        </div>
      }
    >
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="mb-1 flex items-center justify-between text-2xs text-muted-foreground">
          <span>Конкретна</span>
          <span>Широка</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", estimate.breadth === "narrow" ? "bg-warning" : estimate.breadth === "broad" ? "bg-success" : "bg-info")}
            style={{ width: `${breadthPct}%` }}
          />
        </div>
        {estimate.notes.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-2xs text-muted-foreground">
            {estimate.notes.map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-2xs text-muted-foreground">Навчальна оцінка; реальні оцінки розміру аудиторії в рекламних кабінетах також є наближеними.</p>
      </div>

      <label className="flex items-start gap-2">
        <Switch checked={adv} onCheckedChange={(v) => set({ advantageAudience: v })} aria-label="Advantage+ audience" />
        <span className="text-[13px]">
          <span className="font-medium">Advantage+ audience</span>{" "}
          <Badge variant="success" className="ml-1">
            Verified
          </Badge>
          <span className="block text-2xs text-muted-foreground">
            Вік, гендер, інтереси та включені аудиторії стають <b>підказками</b> (suggestions): система спершу шукає схожих людей, а потім розширює показ.
            Жорсткими лишаються лише <b>audience controls</b>: локації, мінімальний вік, мови, виключені аудиторії. <ArticleLink slug="advantage-plus">Докладніше</ArticleLink>
          </span>
        </span>
      </label>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-3">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Audience controls {adv && "(жорсткі обмеження)"}</p>
          <Field label="Локації" error={error} required>
            <LocationsEditor value={value.locations} onChange={(locations) => set({ locations })} minRadius={rules.minCityRadiusKm} />
          </Field>
          {adv && (
            <Field label="Мінімальний вік (control)" tip="Використовуйте лише для бізнес-обмежень (наприклад, юридичних). Решту вікових налаштувань задавайте як підказки.">
              <Select value={String(value.minAgeControl)} onValueChange={(v) => set({ minAgeControl: Number(v) })} disabled={rules.active}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGES.filter((a) => a <= 25).map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Мови" hint="Порожньо = усі мови.">
            <MultiPicker label="Додати мову" options={LANGUAGES.map((l) => ({ id: l.code, label: l.label }))} value={value.languages} onChange={(languages) => set({ languages })} />
          </Field>
          <Field
            label="Виключити custom-аудиторії"
            tip="Виключення detailed targeting (інтересів) більше недоступне; виключати можна власні аудиторії: клієнтів, ліди, відвідувачів."
          >
            <MultiPicker
              label="Виключити аудиторію"
              options={audienceOptions.filter((o) => !lookalikeIds.includes(o.id))}
              value={value.excludedAudienceIds}
              onChange={(excludedAudienceIds) => set({ excludedAudienceIds })}
              disabledIds={value.includedAudienceIds}
            />
          </Field>
        </div>

        <div className="grid gap-3">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            {adv ? "Audience suggestions (необов'язково)" : "Таргетинг"}
            {rules.active && " · обмежено спецкатегорією"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Вік від">
              <Select value={String(value.ageMin)} onValueChange={(v) => set({ ageMin: Number(v) })} disabled={rules.active}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGES.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Вік до">
              <Select value={String(value.ageMax)} onValueChange={(v) => set({ ageMax: Number(v) })} disabled={rules.active}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGES.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a === 65 ? "65+" : a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Стать">
            <Select value={value.genders} onValueChange={(v) => set({ genders: v as AudienceTargeting["genders"] })} disabled={rules.active}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Усі</SelectItem>
                <SelectItem value="male">Чоловіки</SelectItem>
                <SelectItem value="female">Жінки</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={
              <span>
                Detailed targeting{" "}
                <InfoTip>Інтереси з однієї групи комбінуються через «АБО» (розширюють). Разом із custom-аудиторіями — через перетин (звужують).</InfoTip>
              </span>
            }
          >
            <MultiPicker label="Додати інтерес" options={interestOptions} value={value.detailedTargeting} onChange={(detailedTargeting) => set({ detailedTargeting })} />
          </Field>
          <Field label="Custom і lookalike аудиторії">
            <MultiPicker
              label="Додати аудиторію"
              options={audienceOptions}
              value={value.includedAudienceIds}
              onChange={(includedAudienceIds) => set({ includedAudienceIds })}
              disabledIds={[...value.excludedAudienceIds, ...(rules.lookalikesAllowed ? [] : lookalikeIds)]}
            />
          </Field>
        </div>
      </div>
    </FormSection>
  );
}
