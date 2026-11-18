"use client";

import { RotateCcw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-6">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-burgundy">Something went wrong</p>
      <h1 className="mt-2 font-display text-3xl text-charcoal">The dashboard could not be displayed</h1>
      <p className="mt-2 text-sm text-ink-2">
        This is usually temporary. Check that the analytics API is running, then try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-10 w-fit items-center gap-2 rounded-md bg-burgundy px-4 text-sm font-medium text-white transition-colors hover:bg-burgundy-deep"
      >
        <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={2} />
        Try again
      </button>
    </main>
  );
}
