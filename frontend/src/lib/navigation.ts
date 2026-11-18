export interface NavItem {
  label: string;
  href: string;
  /** Sections planned for later parts are listed but not yet routed. */
  ready: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", ready: true },
  { label: "Executive Dashboard", href: "/dashboard", ready: false },
  { label: "Product Analytics", href: "/products", ready: false },
  { label: "Review Analytics", href: "/reviews", ready: false },
  { label: "Brands & Categories", href: "/brands", ready: false },
  { label: "Product Comparison", href: "/compare", ready: false },
  { label: "Data Explorer", href: "/explorer", ready: false },
  { label: "AI Sentiment", href: "/sentiment", ready: false },
];
