import type { Metadata } from "next";
import { MissionCenter } from "@/features/missions/mission-center";

export const metadata: Metadata = { title: "Mission Center" };

export default function MissionsPage() {
  return <MissionCenter />;
}
