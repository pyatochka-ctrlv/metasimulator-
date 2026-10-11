"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Columns3,
  Copy,
  Download,
  Filter,
  History,
  Pencil,
  Plus,
  Search,
  Send,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useActiveAccount, useAppStore } from "@/store/app-store";
import { deleteEntity, duplicateEntity, setEntityStatus } from "@/domain/operations";
import type { AdAccount, Ad, AdSet, Campaign, Objective, PlacementId } from "@/domain/types";
import { OBJECTIVES, placementById } from "@/domain/catalog";
import { aggregate, type RangeKey, type ReportedMetrics } from "@/simulation/reporting";
import { fmtSimDate } from "@/lib/dates";
import { fmtInt, fmtMoney, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog, EmptyState, MetricLabel, PageHeader, SimulatedNotice } from "@/components/common";
import { getMission } from "@/content/missions";
import { getErrorLabCase } from "@/content/error-lab";
import { COLUMN_PRESETS, COLUMNS, type ColumnDef, type Level, type RowData } from "./columns";
import { getDelivery, isPublished, TONE_DOT } from "./delivery";
import { RANGE_LABELS, useEntityReports } from "./use-reports";
import { SimulationBar } from "./simulation-bar";
import { EditSheet, type EditTarget } from "./edit-sheet";
import { PublishDialog } from "./publish-dialog";
import { ChangeLog } from "./change-log";

type Breakdown = "none" | "day" | "placement";
type StatusFilter = "all" | "active" | "paused" | "draft" | "issues";

const LEVEL_LABEL: Record<Level, string> = { campaign: "Кампанії", ad_set: "Набори оголошень", ad: "Оголошення" };

function entitiesFor(account: AdAccount, level: Level): (Campaign | AdSet | Ad)[] {
  return level === "campaign" ? account.campaigns : level === "ad_set" ? account.adSets : account.ads;
}

function MissionBanner({ account }: { account: AdAccount }) {
  const attempts = useAppStore((s) => s.missionAttempts);
  if (account.kind === "mission") {
    const att = Object.values(attempts).find((a) => a.accountId === account.id);
    const mission = att ? getMission(att.missionId) : undefined;
    if (!att || !mission) return null;
    return (
      <div className="flex flex-wrap items-center gap-2 border-b bg-accent/50 px-4 py-2 text-xs sm:px-6">
        <Target className="h-4 w-4 text-primary" />
        <span>
          <b>Місія {mission.number}:</b> {mission.title}
          {att.status === "submitted" && " · здано (лише перегляд)"}
        </span>
        <Button size="xs" variant="outline" className="ml-auto" asChild>
          <Link href={`/missions/${mission.id}?attempt=${att.id}`}>{att.status === "submitted" ? "Результат" : "Бриф і здача місії"}</Link>
        </Button>
      </div>
    );
  }
  if (account.kind === "error_lab" && account.errorLabCaseId) {
    const c = getErrorLabCase(account.errorLabCaseId);
    return (
      <div className="flex flex-wrap items-center gap-2 border-b bg-warning/10 px-4 py-2 text-xs sm:px-6">
        <Target className="h-4 w-4 text-warning" />
        <span>
          <b>Error Lab:</b> {c?.title} · акаунт лише для перегляду
        </span>
        <Button size="xs" variant="outline" className="ml-auto" asChild>
          <Link href={`/error-lab/${account.errorLabCaseId}`}>Повернутися до кейсу</Link>
        </Button>
      </div>
    );
  }
  return null;
}

function toCsv(rows: RowData[], cols: ColumnDef[]): string {
  const raw = (r: RowData, c: ColumnDef) => {
    const v = c.sortValue?.(r);
    return v === null || v === undefined ? "" : String(v);
  };
  const header = ["Level", "Name", "Status", ...cols.map((c) => c.label)];
  const lines = rows.map((r) => [r.level, r.entity.name, r.entity.status, ...cols.map((c) => raw(r, c))]);
  return [header, ...lines].map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function BreakdownRows({ account, row, mode, colSpan }: { account: AdAccount; row: RowData; mode: Breakdown; colSpan: number }) {
  const rows = account.metrics.filter((m) => (row.level === "campaign" ? m.campaignId : row.level === "ad_set" ? m.adSetId : m.adId) === row.entity.id);
  if (!rows.length)
    return (
      <tr>
        <td colSpan={colSpan} className="bg-muted/30 pl-12 text-2xs text-muted-foreground">
          Немає даних для розбивки
        </td>
      </tr>
    );
  if (mode === "day") {
    const days = Array.from(new Set(rows.map((r) => r.day))).sort((a, b) => b - a).slice(0, 14);
    return (
      <tr>
        <td colSpan={colSpan} className="bg-muted/30 p-0">
          <table className="data-table ml-10 w-[calc(100%-2.5rem)] text-xs">
            <thead>
              <tr>
                <th scope="col">День</th>
                <th scope="col" className="text-right">Spend</th>
                <th scope="col" className="text-right">Impr.</th>
                <th scope="col" className="text-right">CPM</th>
                <th scope="col" className="text-right">Link clicks</th>
                <th scope="col" className="text-right">CTR</th>
                <th scope="col" className="text-right">LPV</th>
                <th scope="col" className="text-right">Results</th>
                <th scope="col" className="text-right">Cost/result</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const r = aggregate(account, rows.filter((x) => x.day === d));
                return (
                  <tr key={d}>
                    <td>{fmtSimDate(account.startDate, d, true)}</td>
                    <td className="num text-right">{fmtMoney(r.spend)}</td>
                    <td className="num text-right">{fmtInt(r.impressions)}</td>
                    <td className="num text-right">{fmtMoney(r.cpm)}</td>
                    <td className="num text-right">{fmtInt(r.linkClicks)}</td>
                    <td className="num text-right">{fmtPct(r.ctrLink)}</td>
                    <td className="num text-right">{fmtInt(r.landingPageViews)}</td>
                    <td className="num text-right">
                      {fmtInt(r.results)}
                      {r.incomplete ? "*" : ""}
                    </td>
                    <td className="num text-right">{fmtMoney(r.costPerResult)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </td>
      </tr>
    );
  }
  const totals = new Map<PlacementId, { impressions: number; spend: number; linkClicks: number; lpv: number; conversions: number }>();
  for (const r of rows) {
    for (const [pid, s] of Object.entries(r.byPlacement) as [PlacementId, NonNullable<(typeof r.byPlacement)[PlacementId]>][]) {
      const t = totals.get(pid) ?? { impressions: 0, spend: 0, linkClicks: 0, lpv: 0, conversions: 0 };
      t.impressions += s.impressions;
      t.spend += s.spend;
      t.linkClicks += s.linkClicks;
      t.lpv += s.lpv;
      t.conversions += s.conversions;
      totals.set(pid, t);
    }
  }
  const list = [...totals].sort((a, b) => b[1].spend - a[1].spend);
  return (
    <tr>
      <td colSpan={colSpan} className="bg-muted/30 p-0">
        <table className="data-table ml-10 w-[calc(100%-2.5rem)] text-xs">
          <thead>
            <tr>
              <th scope="col">Плейсмент</th>
              <th scope="col" className="text-right">Spend</th>
              <th scope="col" className="text-right">Impr.</th>
              <th scope="col" className="text-right">CPM</th>
              <th scope="col" className="text-right">Link clicks</th>
              <th scope="col" className="text-right">CTR</th>
              <th scope="col" className="text-right">LPV</th>
              <th scope="col" className="text-right">LPV rate</th>
              <th scope="col" className="text-right">Конверсії (сайт)</th>
            </tr>
          </thead>
          <tbody>
            {list.map(([pid, t]) => (
              <tr key={pid}>
                <td>{placementById(pid).label}</td>
                <td className="num text-right">{fmtMoney(t.spend)}</td>
                <td className="num text-right">{fmtInt(t.impressions)}</td>
                <td className="num text-right">{fmtMoney(t.impressions ? (t.spend / t.impressions) * 1000 : null)}</td>
                <td className="num text-right">{fmtInt(t.linkClicks)}</td>
                <td className="num text-right">{fmtPct(t.impressions ? (t.linkClicks / t.impressions) * 100 : null)}</td>
                <td className="num text-right">{fmtInt(t.lpv)}</td>
                <td className="num text-right">{fmtPct(t.linkClicks ? (t.lpv / t.linkClicks) * 100 : null, 1)}</td>
                <td className="num text-right">{fmtInt(t.conversions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  );
}

export function AdsManager() {
  const router = useRouter();
  const params = useSearchParams();
  const account = useActiveAccount();
  const mutate = useAppStore((s) => s.mutateAccount);
  const prefs = useAppStore((s) => s.prefs);
  const setPrefs = useAppStore((s) => s.setPrefs);

  const initialTab = (params.get("tab") === "adsets" ? "ad_set" : params.get("tab") === "ads" ? "ad" : "campaign") as Level;
  const [level, setLevel] = useState<Level>(initialTab);
  const [selected, setSelected] = useState<Record<Level, Set<string>>>({ campaign: new Set(params.get("highlight") ? [params.get("highlight")!] : []), ad_set: new Set(), ad: new Set() });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [objective, setObjective] = useState<Objective | "all">("all");
  const [breakdown, setBreakdown] = useState<Breakdown>("none");
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [publishIds, setPublishIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const range = prefs.dateRange;
  const reports = useEntityReports(account, range);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(t.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleCols = useMemo(() => {
    const ids = prefs.columnPreset === "custom" ? prefs.customColumns : COLUMN_PRESETS[prefs.columnPreset]?.columns ?? COLUMN_PRESETS.performance.columns;
    return ids.map((id) => COLUMNS.find((c) => c.id === id)).filter((c): c is ColumnDef => Boolean(c) && (!c!.levels || c!.levels.includes(level)));
  }, [prefs.columnPreset, prefs.customColumns, level]);

  const rows: RowData[] = useMemo(() => {
    if (!account || !reports) return [];
    const selC = selected.campaign;
    const selS = selected.ad_set;
    let list = entitiesFor(account, level);
    if (level === "ad_set" && selC.size) list = (list as AdSet[]).filter((s) => selC.has(s.campaignId));
    if (level === "ad") {
      if (selS.size) list = (list as Ad[]).filter((a) => selS.has(a.adSetId));
      else if (selC.size) list = (list as Ad[]).filter((a) => selC.has(a.campaignId));
    }
    if (query.trim()) list = list.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()));
    if (objective !== "all") {
      list = list.filter((e) => {
        const cid = level === "campaign" ? e.id : (e as AdSet | Ad).campaignId;
        return account.campaigns.find((c) => c.id === cid)?.objective === objective;
      });
    }
    if (status !== "all") {
      list = list.filter((e) => {
        if (status === "active") return e.status === "active";
        if (status === "paused") return e.status === "paused";
        if (status === "draft") return e.status === "draft";
        const d = getDelivery(account, level, e);
        return ["rejected", "limited", "warning"].includes(d.tone);
      });
    }
    const map = level === "campaign" ? reports.byCampaign : level === "ad_set" ? reports.byAdSet : reports.byAd;
    const out = list.map((entity) => ({ level, entity, metrics: map.get(entity.id) ?? reports.empty, account }));
    if (sort) {
      const col = COLUMNS.find((c) => c.id === sort.col);
      const val = (r: RowData) => (sort.col === "name" ? r.entity.name : (col?.sortValue?.(r) ?? null));
      out.sort((a, b) => {
        const va = val(a);
        const vb = val(b);
        if (va === null) return 1;
        if (vb === null) return -1;
        const cmp = typeof va === "string" ? va.localeCompare(String(vb)) : (va as number) - (vb as number);
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return out;
  }, [account, reports, level, selected, query, objective, status, sort]);

  const totals: ReportedMetrics | null = useMemo(() => {
    if (!account || !reports) return null;
    const ids = new Set(rows.map((r) => r.entity.id));
    const key = level === "campaign" ? "campaignId" : level === "ad_set" ? "adSetId" : "adId";
    return aggregate(account, reports.rows.filter((r) => ids.has(r[key])));
  }, [account, reports, rows, level]);

  if (!account) return null;

  const sel = selected[level];
  const selectedEntities = rows.filter((r) => sel.has(r.entity.id)).map((r) => r.entity);
  const readOnly = Boolean(account.readOnly);
  const toggleSel = (id: string, on: boolean) => {
    const next = new Set(sel);
    if (on) next.add(id);
    else next.delete(id);
    setSelected({ ...selected, [level]: next });
  };
  const allSelected = rows.length > 0 && rows.every((r) => sel.has(r.entity.id));

  const doDuplicate = () => {
    for (const e of selectedEntities) mutate(account.id, (a) => duplicateEntity(a, level, e.id));
    toast.success(`Дубльовано: ${selectedEntities.length}`, { description: "Копії створено як чернетки." });
  };
  const doDelete = () => {
    for (const e of selectedEntities) mutate(account.id, (a) => deleteEntity(a, level, e.id));
    toast.success(`Видалено: ${selectedEntities.length}`, { description: "Історична статистика збережена у звітах акаунта." });
    setSelected({ ...selected, [level]: new Set() });
    setConfirmDelete(false);
  };
  const campaignIdsForPublish = () => {
    const ids = new Set<string>();
    for (const e of selectedEntities) ids.add(level === "campaign" ? e.id : (e as AdSet | Ad).campaignId);
    if (!ids.size) for (const c of account.campaigns) if (c.status === "draft" || account.adSets.some((s) => s.campaignId === c.id && s.status === "draft") || account.ads.some((a) => a.campaignId === c.id && (a.status === "draft" || a.status === "rejected"))) ids.add(c.id);
    return [...ids];
  };
  const createHref = () => {
    if (level === "ad_set" && selected.campaign.size === 1) return `/campaign-builder?campaignId=${[...selected.campaign][0]}&addAdSet=1&step=adset`;
    if (level === "ad" && selected.ad_set.size === 1) {
      const s = account.adSets.find((x) => x.id === [...selected.ad_set][0]);
      if (s) return `/campaign-builder?campaignId=${s.campaignId}&adSetId=${s.id}&addAd=1&step=ad`;
    }
    return "/campaign-builder";
  };
  const drill = (r: RowData) => {
    if (r.level === "campaign") {
      setSelected({ campaign: new Set([r.entity.id]), ad_set: new Set(), ad: new Set() });
      setLevel("ad_set");
    } else if (r.level === "ad_set") {
      setSelected({ ...selected, ad_set: new Set([r.entity.id]), ad: new Set() });
      setLevel("ad");
    } else setEditTarget({ level: "ad", id: r.entity.id });
  };
  const exportCsv = () => {
    const blob = new Blob(["﻿" + toCsv(rows, visibleCols)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adlab-${level}-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const colSpan = visibleCols.length + 4;

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col">
      <PageHeader
        title="Ads Manager"
        description={`${account.name} · навчальний акаунт · валюта USD (віртуальна)`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setLogOpen(true)}>
              <History /> Журнал змін
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/events-manager">Events Manager</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/analytics">Analytics</Link>
            </Button>
          </>
        }
      />
      <MissionBanner account={account} />
      <SimulationBar account={account} />

      <div className="flex flex-wrap items-center gap-2 border-b bg-surface px-4 py-2 sm:px-6">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Пошук за назвою  ( / )" className="h-8 w-56 pl-7" aria-label="Пошук за назвою" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="h-8 w-44" aria-label="Фільтр статусу">
            <Filter className="h-3.5 w-3.5 opacity-60" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Усі статуси</SelectItem>
            <SelectItem value="active">Увімкнені</SelectItem>
            <SelectItem value="paused">Вимкнені</SelectItem>
            <SelectItem value="draft">Чернетки</SelectItem>
            <SelectItem value="issues">З проблемами доставки</SelectItem>
          </SelectContent>
        </Select>
        <Select value={objective} onValueChange={(v) => setObjective(v as Objective | "all")}>
          <SelectTrigger className="h-8 w-40" aria-label="Фільтр цілі">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Усі цілі</SelectItem>
            {OBJECTIVES.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={(v) => setPrefs({ dateRange: v as RangeKey })}>
          <SelectTrigger className="h-8 w-40" aria-label="Період">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(RANGE_LABELS) as RangeKey[]).map((r) => (
              <SelectItem key={r} value={r}>
                {RANGE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 /> Columns: {prefs.columnPreset === "custom" ? "Custom" : COLUMN_PRESETS[prefs.columnPreset]?.label} <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Набори колонок</DropdownMenuLabel>
              {Object.entries(COLUMN_PRESETS).map(([id, p]) => (
                <DropdownMenuCheckboxItem key={id} checked={prefs.columnPreset === id} onCheckedChange={() => setPrefs({ columnPreset: id })}>
                  {p.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Власний набір</DropdownMenuLabel>
              {COLUMNS.map((c) => {
                const custom = prefs.columnPreset === "custom" ? prefs.customColumns : COLUMN_PRESETS[prefs.columnPreset]?.columns ?? [];
                return (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={custom.includes(c.id)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(v) => setPrefs({ columnPreset: "custom", customColumns: v ? [...custom, c.id] : custom.filter((x) => x !== c.id) })}
                  >
                    {c.label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Select value={breakdown} onValueChange={(v) => setBreakdown(v as Breakdown)}>
            <SelectTrigger className="h-8 w-44" aria-label="Breakdown">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Breakdown: немає</SelectItem>
              <SelectItem value="day">Breakdown: за днями</SelectItem>
              <SelectItem value="placement">Breakdown: плейсменти</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon-sm" onClick={exportCsv} aria-label="Експорт CSV" title="Експорт у CSV">
            <Download />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b bg-surface px-4 sm:px-6">
        <Tabs value={level} onValueChange={(v) => setLevel(v as Level)}>
          <TabsList className="border-b-0">
            {(["campaign", "ad_set", "ad"] as Level[]).map((l) => (
              <TabsTrigger key={l} value={l} data-testid={`tab-${l}`}>
                {LEVEL_LABEL[l]}
                {l !== "campaign" && selected[l === "ad_set" ? "campaign" : "ad_set"].size > 0 && (
                  <Badge variant="secondary">для {selected[l === "ad_set" ? "campaign" : "ad_set"].size} вибраних</Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {(selected.campaign.size > 0 || selected.ad_set.size > 0) && (
          <Button variant="ghost" size="xs" onClick={() => setSelected({ campaign: new Set(), ad_set: new Set(), ad: new Set() })}>
            <X /> Скинути вибір
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 bg-surface px-4 py-2 sm:px-6">
        <Button size="sm" onClick={() => router.push(createHref())} disabled={readOnly} data-testid="create-button">
          <Plus /> Create
        </Button>
        <Button size="sm" variant="outline" disabled={readOnly || selectedEntities.length === 0} onClick={doDuplicate}>
          <Copy /> Duplicate
        </Button>
        <Button size="sm" variant="outline" disabled={selectedEntities.length !== 1} onClick={() => setEditTarget({ level, id: selectedEntities[0].id })}>
          <Pencil /> Edit
        </Button>
        <Button size="sm" variant="outline" disabled={readOnly || selectedEntities.length === 0} onClick={() => setConfirmDelete(true)}>
          <Trash2 /> Delete
        </Button>
        <Button size="sm" variant="outline" disabled={readOnly} onClick={() => {
          const ids = campaignIdsForPublish();
          if (!ids.length) toast.info("Немає змін для публікації", { description: "Оберіть кампанію або створіть чернетку." });
          setPublishIds(ids);
        }} data-testid="publish-button">
          <Send /> Publish
        </Button>
        <span className="ml-auto text-2xs text-muted-foreground">
          {sel.size > 0 ? `Вибрано: ${sel.size}` : `${rows.length} ${LEVEL_LABEL[level].toLowerCase()}`} · {RANGE_LABELS[range]}
        </span>
      </div>

      <div className="min-w-0 flex-1 overflow-x-auto border-t bg-card">
        {rows.length === 0 ? (
          <EmptyState
            title={level === "campaign" ? "Кампаній ще немає" : "Немає об'єктів за цими фільтрами"}
            description={level === "campaign" ? "Створіть першу кампанію в Campaign Builder: оберіть ціль, налаштуйте набір і оголошення, опублікуйте та запустіть симуляцію." : "Змініть фільтри або вибір на попередній вкладці."}
            action={
              !readOnly && (
                <Button asChild>
                  <Link href={createHref()}>
                    <Plus /> Створити
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <table className="data-table w-full min-w-[900px]" aria-label={LEVEL_LABEL[level]}>
            <thead>
              <tr>
                <th scope="col" className="w-8">
                  <Checkbox checked={allSelected ? true : sel.size ? "indeterminate" : false} onCheckedChange={(v) => setSelected({ ...selected, [level]: v ? new Set(rows.map((r) => r.entity.id)) : new Set() })} aria-label="Вибрати всі" />
                </th>
                <th scope="col" className="w-12">On/Off</th>
                <th scope="col">
                  <button type="button" className="flex items-center gap-1" onClick={() => setSort(sort?.col === "name" && sort.dir === "asc" ? { col: "name", dir: "desc" } : { col: "name", dir: "asc" })}>
                    {level === "campaign" ? "Campaign" : level === "ad_set" ? "Ad set" : "Ad"}
                    {sort?.col === "name" && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </button>
                </th>
                <th scope="col">Delivery</th>
                {visibleCols.map((c) => (
                  <th scope="col" key={c.id} className={cn(c.align === "right" && "text-right")}>
                    <button
                      type="button"
                      className={cn("inline-flex items-center gap-1", c.align === "right" && "flex-row-reverse")}
                      onClick={() => c.sortValue && setSort(sort?.col === c.id && sort.dir === "desc" ? { col: c.id, dir: "asc" } : { col: c.id, dir: "desc" })}
                    >
                      {c.metricId ? <MetricLabel id={c.metricId}>{c.label}</MetricLabel> : c.label}
                      {sort?.col === c.id && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = getDelivery(account, level, r.entity);
                const pub = isPublished(r.entity.status) && r.entity.status !== "in_review" && r.entity.status !== "rejected";
                return (
                  <FragmentRow key={r.entity.id}>
                    <tr className={cn(sel.has(r.entity.id) && "bg-accent/40", params.get("highlight") === r.entity.id && "outline outline-1 outline-primary/40")} data-testid={`row-${r.entity.id}`}>
                      <td>
                        <Checkbox checked={sel.has(r.entity.id)} onCheckedChange={(v) => toggleSel(r.entity.id, Boolean(v))} aria-label={`Вибрати ${r.entity.name}`} />
                      </td>
                      <td>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Switch
                                checked={r.entity.status === "active" || r.entity.status === "in_review"}
                                disabled={!pub || readOnly}
                                onCheckedChange={(v) => {
                                  mutate(account.id, (a) => setEntityStatus(a, level, r.entity.id, v));
                                  toast(v ? "Увімкнено" : "Вимкнено", { description: r.entity.name });
                                }}
                                aria-label={`Увімкнути/вимкнути ${r.entity.name}`}
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{pub ? "Увімкнути або призупинити показ" : "Спершу опублікуйте (чернетки, відхилені й ті, що на перевірці, не перемикаються)"}</TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="max-w-[280px]">
                        <div className="flex flex-col">
                          <button type="button" className="truncate text-left font-medium text-primary hover:underline" onClick={() => drill(r)} title={r.entity.name}>
                            {r.entity.name}
                          </button>
                          <span className="flex gap-2 text-2xs text-muted-foreground">
                            <button type="button" className="hover:text-foreground" onClick={() => setEditTarget({ level, id: r.entity.id })}>
                              Редагувати
                            </button>
                            {!readOnly && level === "campaign" && (
                              <Link className="hover:text-foreground" href={`/campaign-builder?campaignId=${r.entity.id}&addAdSet=1&step=adset`}>
                                + набір
                              </Link>
                            )}
                            {!readOnly && level === "ad_set" && (
                              <Link className="hover:text-foreground" href={`/campaign-builder?campaignId=${(r.entity as AdSet).campaignId}&adSetId=${r.entity.id}&addAd=1&step=ad`}>
                                + оголошення
                              </Link>
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1.5 text-xs" tabIndex={0}>
                              <span className={cn("h-2 w-2 rounded-full", TONE_DOT[d.tone])} aria-hidden />
                              {d.label}
                            </span>
                          </TooltipTrigger>
                          {d.hint && <TooltipContent>{d.hint}</TooltipContent>}
                        </Tooltip>
                      </td>
                      {visibleCols.map((c) => (
                        <td key={c.id} className={cn(c.align === "right" && "num text-right")}>
                          {c.render(r)}
                        </td>
                      ))}
                    </tr>
                    {breakdown !== "none" && <BreakdownRows account={account} row={r} mode={breakdown} colSpan={colSpan} />}
                  </FragmentRow>
                );
              })}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="bg-surface-sunken font-medium">
                  <td />
                  <td />
                  <td className="text-xs">
                    Підсумок: {rows.length} {LEVEL_LABEL[level].toLowerCase()}
                  </td>
                  <td />
                  {visibleCols.map((c) => (
                    <td key={c.id} className={cn("num text-xs", c.align === "right" && "text-right")}>
                      {c.total ? c.total(totals) : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
      <div className="flex flex-col gap-2 border-t bg-surface px-4 py-2 sm:px-6">
        <p className="text-2xs text-muted-foreground">* Дані останніх днів можуть бути неповними: частина конверсій надходить із затримкою і додається до дня показу/кліку пізніше.</p>
        <SimulatedNotice compact />
      </div>

      <EditSheet account={account} target={editTarget} onClose={() => setEditTarget(null)} />
      <PublishDialog account={account} campaignIds={publishIds} onClose={() => setPublishIds([])} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title={`Видалити ${selectedEntities.length} об'єкт(и)?`}
        description={
          <span>
            Буде видалено: {selectedEntities.map((e) => e.name).join(", ")}
            {level !== "ad" && " разом із вкладеними об'єктами"}. Дію не можна скасувати; історична статистика залишиться у звітах.
          </span>
        }
        confirmLabel="Видалити"
        onConfirm={doDelete}
      />
      <Sheet open={logOpen} onOpenChange={setLogOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Журнал змін акаунта</SheetTitle>
            <SheetDescription>Усі дії користувача й системи: створення, редагування, публікації, перевірки, скидання навчальної фази.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <ChangeLog account={account} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
