"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Search } from "lucide-react";
import { MAX_SEARCH_LENGTH, MIN_SEARCH_LENGTH, normaliseSearch } from "@/lib/search";

export const SEARCH_DEBOUNCE_MS = 350;

interface SearchFieldProps {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onSearch: (q: string | undefined) => void;
  /** Tailwind width classes from the sm breakpoint up (full width below). */
  width?: string;
}

/**
 * Search box: applies after a short pause in typing (or on Enter), never per keystroke.
 * Input shorter than the API minimum is treated as "no search".
 */
export function SearchField({ id, label, placeholder, value, onSearch, width = "sm:w-72" }: SearchFieldProps) {
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (raw: string) => {
    clearTimeout(timer.current);
    const q = normaliseSearch(raw);
    if (q !== (value || undefined)) onSearch(q);
  };

  const onChange = (raw: string) => {
    setText(raw);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(raw), SEARCH_DEBOUNCE_MS);
  };

  const tooShort = text.trim().length > 0 && text.trim().length < MIN_SEARCH_LENGTH;
  const hintId = `${id}-hint`;

  return (
    <form
      role="search"
      className={`flex min-w-0 flex-col gap-1 ${width}`}
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        commit(text);
      }}
    >
      <label htmlFor={id} className="text-[11px] font-medium text-ink-3">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
          strokeWidth={1.75}
        />
        <input
          id={id}
          type="search"
          value={text}
          maxLength={MAX_SEARCH_LENGTH}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-describedby={tooShort ? hintId : undefined}
          className="h-9 w-full rounded-md border border-line bg-white pl-8 pr-3 text-sm text-charcoal placeholder:text-ink-3 transition-colors hover:border-line-strong focus:border-burgundy focus:outline-none"
        />
      </div>
      {tooShort && (
        <p id={hintId} className="text-[11px] text-ink-3">
          Type at least {MIN_SEARCH_LENGTH} characters
        </p>
      )}
    </form>
  );
}
