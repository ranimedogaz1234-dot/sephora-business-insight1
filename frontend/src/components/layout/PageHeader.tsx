import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  meta?: ReactNode;
  /** Global filter row — one row, above everything it scopes. */
  filters?: ReactNode;
}

/** Sticky top bar: page title, short description, data coverage and the global filters. */
export function PageHeader({ eyebrow, title, description, meta, filters }: PageHeaderProps) {
  return (
    <header className="border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 lg:sticky lg:top-0 lg:z-20">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-x-8 gap-y-3 px-4 pb-4 pt-5 sm:px-6 lg:px-10 lg:pt-7">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-burgundy">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 font-display text-[28px] leading-tight text-charcoal md:text-[34px]">
            {title}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-2">{description}</p>
        </div>
        {meta && <div className="text-xs text-ink-3">{meta}</div>}
      </div>
      {filters && (
        <div className="mx-auto max-w-[1440px] px-4 pb-4 sm:px-6 lg:px-10">{filters}</div>
      )}
    </header>
  );
}
