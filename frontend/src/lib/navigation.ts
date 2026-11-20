import type { LucideIcon } from "lucide-react";
import {
  GitCompareArrows,
  LayoutDashboard,
  MessagesSquare,
  Package,
  Sparkles,
  Table2,
  Tags,
} from "lucide-react";

export interface NavItem {
  label: string;
  /** Route for available pages. Planned pages have no route and are never rendered as links. */
  href: string | null;
  description: string;
  icon: LucideIcon;
  status: "available" | "planned";
}

/**
 * "Overview" and "Executive Dashboard" are one page: the executive overview at "/".
 * Planned sections are shown so the roadmap is visible, but they are not links.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Executive Overview",
    href: "/",
    description: "Headline KPIs and the main review, product, brand and price trends.",
    icon: LayoutDashboard,
    status: "available",
  },
  {
    label: "Product Analytics",
    href: "/products",
    description: "Search, filter and rank the catalogue; product details with review insights.",
    icon: Package,
    status: "available",
  },
  {
    label: "Review Analytics",
    href: null,
    description: "Review volume, ratings and reviewer profiles.",
    icon: MessagesSquare,
    status: "planned",
  },
  {
    label: "Brands & Categories",
    href: null,
    description: "Brand and category performance.",
    icon: Tags,
    status: "planned",
  },
  {
    label: "Product Comparison",
    href: null,
    description: "Side-by-side product comparison.",
    icon: GitCompareArrows,
    status: "planned",
  },
  {
    label: "Data Explorer",
    href: null,
    description: "Search, filter and page through the records.",
    icon: Table2,
    status: "planned",
  },
  {
    label: "AI Sentiment Analysis",
    href: null,
    description: "Sentiment in review text.",
    icon: Sparkles,
    status: "planned",
  },
];

export const AVAILABLE_ITEMS = NAV_ITEMS.filter((i) => i.status === "available");
export const PLANNED_ITEMS = NAV_ITEMS.filter((i) => i.status === "planned");

export function isActive(item: NavItem, pathname: string): boolean {
  if (!item.href) return false;
  return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
}
