"use client";

import { Play } from "lucide-react";
import { libraryAsset } from "@/domain/catalog";
import type { AspectRatio, CreativeMedia } from "@/domain/types";
import { cn } from "@/lib/utils";

export const ASPECT_CLASS: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

/** Відображення медіа: бібліотечні ассети генеруються як градієнт із підписом, завантажені — як зображення/постер. */
export function MediaVisual({ media, className, fit = "cover", showBadge = true }: { media: CreativeMedia | null | undefined; className?: string; fit?: "cover" | "contain"; showBadge?: boolean }) {
  if (!media) {
    return <div className={cn("flex items-center justify-center bg-muted text-2xs text-muted-foreground", className)}>Немає медіа</div>;
  }
  const asset = media.source === "library" ? libraryAsset(media.libraryKey) : undefined;
  return (
    <div className={cn("relative overflow-hidden bg-black/80", className)}>
      {media.source === "upload" && media.dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.dataUrl} alt={media.label} className={cn("h-full w-full", fit === "cover" ? "object-cover" : "object-contain")} />
      ) : asset ? (
        <div
          className="flex h-full w-full items-end p-[8%] text-white"
          style={{ background: `linear-gradient(135deg, ${asset.palette[0]}, ${asset.palette[1]})`, containerType: "inline-size" } as React.CSSProperties}
          role="img"
          aria-label={asset.label}
        >
          <span className="text-balance text-[clamp(8px,8cqw,22px)] font-bold leading-tight drop-shadow">{asset.caption}</span>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-2xs text-white/70">{media.label}</div>
      )}
      {showBadge && media.kind === "video" && (
        <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[10px] font-medium text-white">
          <Play className="h-2.5 w-2.5" /> {media.durationSec ? `${Math.floor(media.durationSec / 60)}:${String(Math.round(media.durationSec % 60)).padStart(2, "0")}` : "відео"}
        </span>
      )}
    </div>
  );
}

export function MediaThumb({ media, className, selected, onClick }: { media: CreativeMedia; className?: string; selected?: boolean; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group flex flex-col gap-1 rounded-md border p-1 text-left transition-colors",
        onClick && "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary ring-1 ring-primary",
        className,
      )}
      aria-pressed={onClick ? selected : undefined}
    >
      <div className="flex h-24 w-full items-center justify-center rounded bg-muted/50">
        <MediaVisual media={media} className={cn("h-full max-w-full rounded", ASPECT_CLASS[media.aspectRatio])} />
      </div>
      <span className="line-clamp-2 px-0.5 text-2xs leading-tight">{media.label}</span>
      <span className="px-0.5 text-[10px] text-muted-foreground">
        {media.kind === "video" ? "Відео" : "Зображення"} · {media.aspectRatio}
      </span>
    </Comp>
  );
}
