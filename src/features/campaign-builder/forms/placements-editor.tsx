"use client";

import { PLACEMENTS } from "@/domain/catalog";
import type { PlacementId } from "@/domain/types";
import { FEATURE_REGISTRY } from "@/content/feature-registry";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceCard, FormSection } from "@/components/common/field";
import { ArticleLink } from "@/components/common";

const GROUPS = ["Feeds", "Stories", "Reels", "Search", "Messages", "Apps and sites"] as const;

export function PlacementsEditor({
  value,
  onChange,
  error,
}: {
  value: { mode: "advantage" | "manual"; selected: PlacementId[] };
  onChange: (v: { mode: "advantage" | "manual"; selected: PlacementId[] }) => void;
  error?: string;
}) {
  const toggle = (id: PlacementId, on: boolean) => onChange({ ...value, selected: on ? [...value.selected, id] : value.selected.filter((x) => x !== id) });
  return (
    <FormSection title="Плейсменти" description="Де показуватимуться оголошення.">
      <div role="radiogroup" aria-label="Режим плейсментів" className="grid gap-2 sm:grid-cols-2">
        <ChoiceCard
          selected={value.mode === "advantage"}
          onSelect={() => onChange({ mode: "advantage", selected: value.selected })}
          title="Advantage+ placements (рекомендовано)"
          description="Система розподіляє бюджет між усіма доступними плейсментами там, де очікує кращий результат."
        />
        <ChoiceCard
          selected={value.mode === "manual"}
          onSelect={() => onChange({ mode: "manual", selected: value.selected.length ? value.selected : ["facebook_feed", "instagram_feed", "instagram_stories", "instagram_reels"] })}
          title="Manual placements"
          description="Ви самостійно обираєте плейсменти. Обмежений інвентар зазвичай дорожчий."
        />
      </div>
      {value.mode === "manual" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((g) => {
            const items = PLACEMENTS.filter((p) => p.group === g);
            return (
              <div key={g} className="rounded-md border p-2.5">
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</p>
                <ul className="space-y-1">
                  {items.map((p) => {
                    const feature = p.featureId ? FEATURE_REGISTRY.find((f) => f.id === p.featureId) : undefined;
                    return (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                          <Checkbox checked={value.selected.includes(p.id)} onCheckedChange={(v) => toggle(p.id, Boolean(v))} />
                          {p.label}
                          {feature && feature.availability_status !== "Verified" && (
                            <Badge variant="warning" title={feature.version_notes}>
                              {feature.availability_status}
                            </Badge>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="text-2xs font-medium text-destructive">{error}</p>}
      <p className="text-2xs text-muted-foreground">
        Порада: для Stories і Reels додайте вертикальну версію креативу (9:16). <ArticleLink slug="placements">Про плейсменти</ArticleLink>
      </p>
    </FormSection>
  );
}
