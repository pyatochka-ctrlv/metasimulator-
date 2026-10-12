"use client";

import { useRef, useState } from "react";
import { ImagePlus, Upload, Video, X } from "lucide-react";
import { toast } from "sonner";
import { MEDIA_LIBRARY } from "@/domain/catalog";
import type { AspectRatio, CreativeMedia } from "@/domain/types";
import { libMedia } from "@/domain/account-builder";
import { newId } from "@/lib/ids";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaThumb } from "./media-thumb";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export function nearestAspect(w: number, h: number): AspectRatio {
  const r = w / h;
  const options: [AspectRatio, number][] = [
    ["1:1", 1],
    ["4:5", 0.8],
    ["9:16", 9 / 16],
    ["16:9", 16 / 9],
  ];
  return options.reduce((best, cur) => (Math.abs(cur[1] - r) < Math.abs(best[1] - r) ? cur : best))[0];
}

/** Зменшує зображення до max 640px і повертає JPEG dataURL — щоб не переповнити сховище браузера. */
async function downscale(source: CanvasImageSource, w: number, h: number): Promise<string> {
  const scale = Math.min(1, 640 / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступний");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export async function fileToMedia(file: File): Promise<CreativeMedia> {
  if (file.type.startsWith("image/")) {
    if (file.size > MAX_IMAGE_BYTES) throw new Error("Зображення більше 10 МБ");
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Не вдалося прочитати зображення"));
        img.src = url;
      });
      const dataUrl = await downscale(img, img.naturalWidth, img.naturalHeight);
      return { id: newId("med"), kind: "image", aspectRatio: nearestAspect(img.naturalWidth, img.naturalHeight), source: "upload", dataUrl, label: file.name };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (file.type.startsWith("video/")) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error("Відео більше 200 МБ");
    const url = URL.createObjectURL(file);
    try {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.src = url;
      await new Promise<void>((res, rej) => {
        video.onloadeddata = () => res();
        video.onerror = () => rej(new Error("Формат відео не підтримується браузером"));
      });
      const duration = Number.isFinite(video.duration) ? video.duration : 30;
      await new Promise<void>((res) => {
        video.onseeked = () => res();
        video.currentTime = Math.min(0.5, duration / 2);
      });
      const dataUrl = await downscale(video, video.videoWidth || 720, video.videoHeight || 1280);
      return {
        id: newId("med"),
        kind: "video",
        aspectRatio: nearestAspect(video.videoWidth || 9, video.videoHeight || 16),
        source: "upload",
        dataUrl,
        label: file.name,
        durationSec: Math.round(duration),
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  throw new Error("Підтримуються лише зображення та відео");
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  onPick,
  filter,
  title = "Медіатека",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (m: CreativeMedia) => void;
  filter?: (m: { kind: "image" | "video"; aspectRatio: AspectRatio }) => boolean;
  title?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const assets = MEDIA_LIBRARY.filter((a) => !filter || filter(a));

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const m = await fileToMedia(f);
      if (filter && !filter(m)) {
        toast.warning("Файл не відповідає вимогам цього поля", { description: `Отримано ${m.kind === "video" ? "відео" : "зображення"} ${m.aspectRatio}.` });
      }
      onPick(m);
      onOpenChange(false);
      toast.success("Медіа завантажено", {
        description: m.kind === "video" ? "Відео не зберігається повністю — у навчальному акаунті зберігаються постер і тривалість." : "Зображення зменшено для збереження в браузері.",
      });
    } catch (e) {
      toast.error("Не вдалося завантажити файл", { description: (e as Error).message });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Оберіть навчальний креатив або завантажте власне тестове зображення чи відео.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library">
              <ImagePlus /> Бібліотека
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload /> Завантажити
            </TabsTrigger>
          </TabsList>
          <TabsContent value="library" className="pt-3">
            <div className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
              {assets.map((a) => (
                <MediaThumb
                  key={a.key}
                  media={libMedia(a.key, newId("med"))}
                  onClick={() => {
                    onPick(libMedia(a.key, newId("med")));
                    onOpenChange(false);
                  }}
                />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="upload" className="pt-3">
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
              <div className="flex gap-2 text-muted-foreground">
                <ImagePlus className="h-6 w-6" />
                <Video className="h-6 w-6" />
              </div>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP до 10 МБ або MP4/WebM до 200 МБ. Зображення зменшуються до 640 px; для відео зберігаються постер-кадр і тривалість (сам файл
                залишається на вашому пристрої).
              </p>
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Файл медіа" />
              <Button onClick={() => fileRef.current?.click()} disabled={busy}>
                <Upload /> {busy ? "Обробка…" : "Обрати файл"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function MediaList({ media, onRemove }: { media: CreativeMedia[]; onRemove: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {media.map((m) => (
        <div key={m.id} className="relative">
          <MediaThumb media={m} />
          <Button type="button" variant="secondary" size="icon-sm" className="absolute right-1 top-1 h-6 w-6" onClick={() => onRemove(m.id)} aria-label={`Прибрати ${m.label}`}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
