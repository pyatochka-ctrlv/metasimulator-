import { Suspense } from "react";
import type { Metadata } from "next";
import { CaseFromQuery } from "@/features/portfolio/portfolio";

export const metadata: Metadata = { title: "Навчальний кейс" };

export default function CasePage() {
  return (
    <Suspense>
      <CaseFromQuery />
    </Suspense>
  );
}
