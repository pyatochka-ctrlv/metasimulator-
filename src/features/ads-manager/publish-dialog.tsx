"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { publishCampaign } from "@/domain/operations";
import type { AdAccount } from "@/domain/types";
import { hasBlockingErrors, validateCampaignTree } from "@/simulation/validation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IssueList } from "@/features/campaign-builder/builder";

export function PublishDialog({ account, campaignIds, onClose }: { account: AdAccount; campaignIds: string[]; onClose: () => void }) {
  const mutate = useAppStore((s) => s.mutateAccount);
  const checks = useMemo(() => campaignIds.map((id) => ({ id, name: account.campaigns.find((c) => c.id === id)?.name ?? id, issues: validateCampaignTree(account, id) })), [account, campaignIds]);
  const publishable = checks.filter((c) => !hasBlockingErrors(c.issues));

  const publish = () => {
    let count = 0;
    mutate(account.id, (a) => {
      let acc = a;
      for (const c of publishable) {
        const r = publishCampaign(acc, c.id);
        if (r.published) {
          acc = r.account;
          count++;
        }
      }
      return acc;
    });
    toast.success(`Опубліковано: ${count}`, { description: "Оголошення на перевірці. Натисніть «Simulate 1 day», щоб завершити перевірку й почати показ." });
    onClose();
  };

  return (
    <Dialog open={campaignIds.length > 0} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Перевірка перед публікацією</DialogTitle>
          <DialogDescription>Помилки блокують публікацію. Попередження — ризики для результату, які варто усвідомлювати.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto">
          {checks.map((c) => (
            <section key={c.id}>
              <h3 className="mb-1.5 text-[13px] font-semibold">{c.name}</h3>
              <IssueList issues={c.issues} />
            </section>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Скасувати
          </Button>
          <Button onClick={publish} disabled={publishable.length === 0} data-testid="confirm-publish">
            <Send /> Опублікувати {publishable.length < checks.length ? `(${publishable.length} з ${checks.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
