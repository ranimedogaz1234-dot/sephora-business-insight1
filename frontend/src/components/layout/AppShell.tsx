"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar, type ApiStatus } from "./Sidebar";

/* Sidebar collapse preference: a per-viewer convenience kept in localStorage. */
const STORAGE_KEY = "sbi.sidebar.collapsed";
const CHANGE_EVENT = "sbi:sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* storage unavailable (private mode) — preference just isn't remembered */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function AppShell({ children, status }: { children: ReactNode; status: ApiStatus }) {
  // Server render and hydration use "expanded"; the stored preference applies right after.
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  const toggleCollapsed = useCallback(() => writeCollapsed(!readCollapsed()), []);

  // Links inside the drawer call this too, so it closes on navigation.
  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    menuButton.current?.focus();
  }, []);

  // Esc closes the drawer; lock page scroll and move focus into it while open.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMobile();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen, closeMobile]);

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-white transition-[width] duration-200 lg:block ${
          collapsed ? "w-[76px]" : "w-[280px]"
        }`}
      >
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} status={status} />
      </aside>

      {/* Mobile header */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white px-4 lg:hidden">
        <button
          ref={menuButton}
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          className="grid h-9 w-9 place-items-center rounded-md text-charcoal hover:bg-light-gray"
        >
          <Menu aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <span className="font-display text-[17px] text-charcoal">Sephora</span>
        <span className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-3">
          Business Insight
        </span>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            tabIndex={-1}
            onClick={closeMobile}
            className="absolute inset-0 bg-charcoal/30"
          />
          <div
            id="mobile-navigation"
            ref={drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-[284px] max-w-[85vw] border-r border-line bg-white shadow-xl"
          >
            <button
              type="button"
              onClick={closeMobile}
              aria-label="Close navigation"
              className="absolute right-3 top-3.5 grid h-9 w-9 place-items-center rounded-md text-ink-2 hover:bg-light-gray"
            >
              <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <Sidebar onNavigate={closeMobile} status={status} />
          </div>
        </div>
      )}

      <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-[76px]" : "lg:pl-[280px]"}`}>
        {children}
      </div>
    </div>
  );
}
