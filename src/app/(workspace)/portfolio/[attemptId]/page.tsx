import type { Metadata } from "next";
import { CaseView } from "@/features/portfolio/portfolio";

export const metadata: Metadata = { title: "Навчальний кейс" };

export default async function CasePage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <CaseView attemptId={attemptId} />;
}
