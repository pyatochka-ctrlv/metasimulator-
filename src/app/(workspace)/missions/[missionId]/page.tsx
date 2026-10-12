import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMission, MISSIONS } from "@/content/missions";
import { MissionDetail } from "@/features/missions/mission-detail";

export function generateStaticParams() {
  return MISSIONS.map((m) => ({ missionId: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ missionId: string }> }): Promise<Metadata> {
  const { missionId } = await params;
  const m = getMission(missionId);
  return { title: m ? `Місія ${m.number}: ${m.title}` : "Місія" };
}

export default async function MissionPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  if (!getMission(missionId)) notFound();
  return (
    <Suspense>
      <MissionDetail missionId={missionId} />
    </Suspense>
  );
}
