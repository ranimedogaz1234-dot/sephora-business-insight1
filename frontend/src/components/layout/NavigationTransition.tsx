"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useTransition } from "react";
import type { ReactNode } from "react";

interface NavigationTransition {
  isPending: boolean;
  /** Replace the current URL's query string inside a transition (keeps scroll position). */
  setQuery: (params: URLSearchParams) => void;
}

const Ctx = createContext<NavigationTransition>({ isPending: false, setQuery: () => {} });

export function NavigationTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const setQuery = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [pathname, router],
  );

  const value = useMemo(() => ({ isPending, setQuery }), [isPending, setQuery]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useNavigationTransition = () => useContext(Ctx);

/**
 * While new data loads, keep the previous render on screen at reduced opacity —
 * no skeleton flash and no layout jump.
 */
export function PendingFrame({ children }: { children: ReactNode }) {
  const { isPending } = useNavigationTransition();
  return (
    <div
      aria-busy={isPending}
      className={`transition-opacity duration-200 ${isPending ? "pointer-events-none opacity-55" : "opacity-100"}`}
    >
      {children}
    </div>
  );
}
