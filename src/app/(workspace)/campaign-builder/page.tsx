import { Suspense } from "react";
import type { Metadata } from "next";
import { CampaignBuilder } from "@/features/campaign-builder/builder";

export const metadata: Metadata = { title: "Campaign Builder" };

export default function CampaignBuilderPage() {
  return (
    <Suspense>
      <CampaignBuilder />
    </Suspense>
  );
}
