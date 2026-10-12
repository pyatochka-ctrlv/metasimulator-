import type { Metadata } from "next";
import { EventsManager } from "@/features/events-manager/events-manager";

export const metadata: Metadata = { title: "Events Manager" };

export default function EventsManagerPage() {
  return <EventsManager />;
}
