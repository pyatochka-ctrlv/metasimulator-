import {
  BarChart3,
  BookOpen,
  Briefcase,
  Bug,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Radar,
  Settings,
  SquarePlus,
  Target,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  shortcut?: string;
  sub?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", hint: "Огляд прогресу", icon: LayoutDashboard, shortcut: "1" },
  { href: "/ads-manager", label: "Ads Manager", hint: "Робоче середовище", icon: Megaphone, shortcut: "2" },
  { href: "/events-manager", label: "Events Manager", hint: "Pixel, CAPI, згода", icon: Radar, sub: true },
  { href: "/campaign-builder", label: "Campaign Builder", hint: "Створення кампанії", icon: SquarePlus, shortcut: "3" },
  { href: "/analytics", label: "Analytics", hint: "Звіти та діагностика", icon: BarChart3, shortcut: "4" },
  { href: "/missions", label: "Mission Center", hint: "Практичні брифи", icon: Target, shortcut: "5" },
  { href: "/error-lab", label: "Error Lab", hint: "Знайди причину", icon: Bug, shortcut: "6" },
  { href: "/knowledge", label: "Knowledge Base", hint: "База знань", icon: BookOpen, shortcut: "7" },
  { href: "/learning", label: "Learning Path", hint: "Навчальний маршрут", icon: GraduationCap, shortcut: "8" },
  { href: "/portfolio", label: "Portfolio", hint: "Навчальні кейси", icon: Briefcase, shortcut: "9" },
  { href: "/settings", label: "Settings", hint: "Налаштування", icon: Settings, shortcut: "0" },
];
