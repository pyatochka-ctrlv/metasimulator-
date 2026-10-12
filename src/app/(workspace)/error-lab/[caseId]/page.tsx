import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ERROR_LAB_CASES, getErrorLabCase } from "@/content/error-lab";
import { ErrorLabCaseView } from "@/features/error-lab/error-lab";

export function generateStaticParams() {
  return ERROR_LAB_CASES.map((c) => ({ caseId: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ caseId: string }> }): Promise<Metadata> {
  const { caseId } = await params;
  return { title: getErrorLabCase(caseId)?.title ?? "Error Lab" };
}

export default async function ErrorLabCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (!getErrorLabCase(caseId)) notFound();
  return <ErrorLabCaseView caseId={caseId} />;
}
