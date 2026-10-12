import type { Metadata } from "next";
import { KnowledgeIndex } from "@/features/knowledge/knowledge";

export const metadata: Metadata = { title: "Knowledge Base" };

export default function KnowledgePage() {
  return <KnowledgeIndex />;
}
