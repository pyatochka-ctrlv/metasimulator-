import type { Metadata } from "next";
import { LearningPath } from "@/features/learning/learning-path";

export const metadata: Metadata = { title: "Learning Path" };

export default function LearningPage() {
  return <LearningPath />;
}
