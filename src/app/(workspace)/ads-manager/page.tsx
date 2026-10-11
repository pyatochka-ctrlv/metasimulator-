import { Suspense } from "react";
import type { Metadata } from "next";
import { AdsManager } from "@/features/ads-manager/ads-manager";

export const metadata: Metadata = { title: "Ads Manager" };

export default function AdsManagerPage() {
  return (
    <Suspense>
      <AdsManager />
    </Suspense>
  );
}
