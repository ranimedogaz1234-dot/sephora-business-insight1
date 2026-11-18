/** Neutral placeholder block shown while a route's data loads (no fake figures). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-light-gray ${className}`} />;
}

/** Page-level loading frame: header placeholder plus a status message for screen readers. */
export function PageSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="border-b border-line">
        <div className="mx-auto max-w-[1440px] space-y-3 px-4 pb-5 pt-6 sm:px-6 lg:px-10 lg:pt-8">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
    </div>
  );
}
