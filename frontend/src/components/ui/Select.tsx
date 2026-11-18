"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  /** Tailwind width classes from the sm breakpoint up (full width below). */
  width?: string;
  disabled?: boolean;
}

/** Labelled native select in the shared filter style. */
export function Select({ label, value, onChange, children, width = "sm:w-44", disabled }: SelectProps) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-medium text-ink-3">
        {label}
      </label>
      <div className={`relative w-full ${width}`}>
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full appearance-none rounded-md border border-line bg-white pl-3 pr-8 text-sm text-charcoal transition-colors hover:border-line-strong focus:border-burgundy focus:outline-none disabled:cursor-not-allowed disabled:bg-light-gray disabled:text-ink-3"
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
          strokeWidth={1.75}
        />
      </div>
    </div>
  );
}
