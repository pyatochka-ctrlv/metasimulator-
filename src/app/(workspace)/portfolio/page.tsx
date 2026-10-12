import type { Metadata } from "next";
import { PortfolioIndex } from "@/features/portfolio/portfolio";

export const metadata: Metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  return <PortfolioIndex />;
}
