"use client";

import { useState } from "react";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Music2, Send, ThumbsUp } from "lucide-react";
import { ctaLabel } from "@/domain/catalog";
import type { Creative } from "@/domain/types";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ASPECT_CLASS, MediaVisual } from "./media-thumb";

/**
 * Узагальнений попередній перегляд у стилі соцмереж (власна розмітка симулятора, не копія інтерфейсу Meta).
 * Показує, як текст обрізається і як медіа вписується в різні формати.
 */

const FEED_TRUNCATE = 125;

function Avatar({ name }: { name: string }) {
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-4 text-xs font-bold text-white">{name.slice(0, 1)}</span>;
}

function FeedPreview({ creative, pageName }: { creative: Creative; pageName: string }) {
  const [expanded, setExpanded] = useState(false);
  const text = creative.primaryText || "Основний текст оголошення…";
  const truncated = text.length > FEED_TRUNCATE && !expanded;
  const media = creative.media[0];
  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-lg border bg-white text-[12px] text-neutral-900 shadow-sm">
      <div className="flex items-center gap-2 p-2.5">
        <Avatar name={pageName} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold">{pageName}</p>
          <p className="text-[10px] text-neutral-500">Реклама · навчальний перегляд</p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-neutral-500" />
      </div>
      <p className="whitespace-pre-line px-2.5 pb-2">
        {truncated ? text.slice(0, FEED_TRUNCATE).trimEnd() + "… " : text + " "}
        {text.length > FEED_TRUNCATE && (
          <button type="button" className="font-medium text-neutral-500" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "менше" : "ще"}
          </button>
        )}
      </p>
      <MediaVisual media={media} className={cn("w-full", media ? (media.aspectRatio === "9:16" ? "aspect-[4/5]" : ASPECT_CLASS[media.aspectRatio]) : "aspect-square")} />
      <div className="flex items-center gap-2 bg-neutral-100 px-2.5 py-2">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[10px] uppercase text-neutral-500">{creative.displayLink || "website.example"}</p>
          <p className="truncate font-semibold">{creative.headline || "Заголовок"}</p>
          {creative.description && <p className="truncate text-[11px] text-neutral-600">{creative.description}</p>}
        </div>
        {creative.cta !== "NO_BUTTON" && <span className="shrink-0 rounded bg-neutral-200 px-2.5 py-1.5 text-[11px] font-semibold">{ctaLabel(creative.cta)}</span>}
      </div>
      <div className="flex justify-around border-t py-1.5 text-[11px] text-neutral-600">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3.5 w-3.5" /> Подобається
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="h-3.5 w-3.5" /> Коментар
        </span>
        <span className="flex items-center gap-1">
          <Send className="h-3.5 w-3.5" /> Поділитися
        </span>
      </div>
    </div>
  );
}

function VerticalPreview({ creative, pageName, mode }: { creative: Creative; pageName: string; mode: "stories" | "reels" }) {
  const media = creative.verticalMedia ?? creative.media[0];
  const fitsVertical = media?.aspectRatio === "9:16";
  return (
    <div className="mx-auto w-full max-w-[230px]">
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-neutral-900 text-white shadow-lg">
        {fitsVertical ? (
          <MediaVisual media={media} className="absolute inset-0 h-full w-full" showBadge={false} />
        ) : (
          <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-b from-neutral-800 to-neutral-950">
            <MediaVisual media={media} className={cn("w-full", media ? ASPECT_CLASS[media.aspectRatio] : "aspect-square")} showBadge={false} />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-gradient-to-b from-black/60 to-transparent p-2 text-[10px]">
          {mode === "stories" && <div className="absolute inset-x-2 top-1 h-0.5 rounded bg-white/40" />}
          <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">{pageName.slice(0, 1)}</span>
          <span className="mt-1 truncate font-semibold">{pageName}</span>
          <span className="mt-1 text-white/70">· Реклама</span>
        </div>
        {mode === "reels" && (
          <div className="absolute bottom-16 right-2 flex flex-col items-center gap-3 text-white/90">
            <Heart className="h-4 w-4" />
            <MessageCircle className="h-4 w-4" />
            <Send className="h-4 w-4" />
            <Bookmark className="h-4 w-4" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 pt-8 text-[10px]">
          {mode === "reels" && <p className="mb-1.5 line-clamp-2 pr-8">{creative.primaryText || "Основний текст…"}</p>}
          {mode === "reels" && (
            <p className="mb-2 flex items-center gap-1 text-white/70">
              <Music2 className="h-3 w-3" /> Оригінальний звук
            </p>
          )}
          {creative.cta !== "NO_BUTTON" && <div className="rounded-md bg-white py-1.5 text-center text-[11px] font-semibold text-neutral-900">{ctaLabel(creative.cta)}</div>}
        </div>
      </div>
      {!fitsVertical && (
        <p className="mt-2 text-center text-2xs text-warning">Медіа не 9:16 — у вертикальному форматі з&apos;являться порожні поля. Додайте вертикальну версію.</p>
      )}
    </div>
  );
}

export function AdPreview({ creative, pageName }: { creative: Creative; pageName: string }) {
  const [tab, setTab] = useState<"feed" | "stories" | "reels">("feed");
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="feed">Feed</TabsTrigger>
          <TabsTrigger value="stories">Stories</TabsTrigger>
          <TabsTrigger value="reels">Reels</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="rounded-lg bg-muted/50 p-3">
        {tab === "feed" ? <FeedPreview creative={creative} pageName={pageName} /> : <VerticalPreview creative={creative} pageName={pageName} mode={tab} />}
      </div>
      <p className="text-2xs text-muted-foreground">Навчальний макет. Реальне відображення залежить від плейсмента, пристрою та версії застосунку.</p>
    </div>
  );
}
