"use client";

import { useMemo, useState } from "react";
import type { AdAccount, ChangeLogEntry } from "@/domain/types";
import { fmtDateTime, fmtSimDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common";

const ACTION_LABEL: Record<ChangeLogEntry["action"], string> = {
  create: "Створено",
  update: "Змінено",
  duplicate: "Дубльовано",
  delete: "Видалено",
  publish: "Опубліковано",
  pause: "Вимкнено",
  activate: "Увімкнено",
  review_approved: "Перевірку пройдено",
  review_rejected: "Відхилено",
  simulate: "Симуляція",
  learning_reset: "Скидання навчання",
  tracking_update: "Трекінг",
  audience_create: "Аудиторія",
};

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 77) + "…" : s;
  }
  return String(v);
}

export function ChangeLog({ account, entityId, limit = 300 }: { account: AdAccount; entityId?: string; limit?: number }) {
  const [q, setQ] = useState("");
  const [hideSim, setHideSim] = useState(true);
  const entries = useMemo(() => {
    let list = [...account.changeLog].reverse();
    if (entityId) list = list.filter((e) => e.entityId === entityId || (e.changes.some((c) => c.to === entityId)));
    if (hideSim) list = list.filter((e) => e.action !== "simulate");
    if (q) list = list.filter((e) => `${e.entityName} ${e.note ?? ""} ${e.changes.map((c) => c.field).join(" ")}`.toLowerCase().includes(q.toLowerCase()));
    return list.slice(0, limit);
  }, [account.changeLog, entityId, q, hideSim, limit]);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук у журналі…" className="h-7 max-w-xs text-xs" aria-label="Пошук у журналі" />
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={hideSim} onChange={(e) => setHideSim(e.target.checked)} /> Приховати записи симуляції
        </label>
      </div>
      {entries.length === 0 ? (
        <EmptyState title="Записів немає" description="Тут з'являтимуться створення, редагування, публікації, перевірки та скидання навчальної фази." />
      ) : (
        <ol className="grid gap-1.5">
          {entries.map((e) => (
            <li key={e.id} className="rounded-md border px-2.5 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={e.action === "learning_reset" || e.action === "review_rejected" ? "warning" : e.actor === "system" ? "secondary" : "default"}>{ACTION_LABEL[e.action]}</Badge>
                {e.significantEdit && <Badge variant="warning">суттєве редагування</Badge>}
                <span className="font-medium">{e.entityName}</span>
                <span className="ml-auto text-2xs text-muted-foreground">
                  {fmtSimDate(account.startDate, e.simDay)} (день {e.simDay + 1}) · {e.actor === "user" ? "ви" : "система"} · {fmtDateTime(e.at)}
                </span>
              </div>
              {e.changes.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-2xs text-muted-foreground">
                  {e.changes.slice(0, 6).map((c, i) => (
                    <li key={i}>
                      <span className="font-mono">{c.field}</span>: {fmtValue(c.from)} → <span className="text-foreground">{fmtValue(c.to)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {e.note && <p className="mt-1 text-2xs">{e.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
