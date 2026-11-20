export type Scope = "reviews" | "catalogue";

const LABELS: Record<Scope, { text: string; title: string }> = {
  reviews: {
    text: "Review records",
    title: "Computed from the review CSV records (Skincare). Follows the global filters.",
  },
  catalogue: {
    text: "Catalogue · all products",
    title: "Computed from product_info.csv (every catalogue category). Not affected by review filters.",
  },
};

/** Labels every figure with its data source, so review and catalogue numbers never blur. */
export function ScopeTag({ scope }: { scope: Scope }) {
  const { text, title } = LABELS[scope];
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.14em] ${
        scope === "reviews" ? "text-burgundy" : "text-ink-3"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${scope === "reviews" ? "bg-burgundy" : "bg-ink-3"}`}
      />
      {text}
    </span>
  );
}
