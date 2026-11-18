import { CircleAlert, SearchX } from "lucide-react";

export function EmptyState({ message = "No reviews match the current filters." }: { message?: string }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-lg bg-light-gray px-6 py-10 text-center">
      <SearchX aria-hidden className="h-5 w-5 text-ink-3" strokeWidth={1.75} />
      <p className="text-sm text-ink-2">{message}</p>
    </div>
  );
}

export function SectionError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-line px-6 py-10 text-center"
    >
      <CircleAlert aria-hidden className="h-5 w-5 text-burgundy" strokeWidth={1.75} />
      <p className="text-sm font-medium text-charcoal">This section could not be loaded</p>
      <p className="max-w-sm text-xs text-ink-3">{message}</p>
    </div>
  );
}
