import type { Metadata } from "next";
import { ErrorLabIndex } from "@/features/error-lab/error-lab";

export const metadata: Metadata = { title: "Error Lab" };

export default function ErrorLabPage() {
  return <ErrorLabIndex />;
}
