"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AVAILABLE_ITEMS, PLANNED_ITEMS, isActive, type NavItem } from "@/lib/navigation";

export interface ApiStatus {
  connected: boolean;
  datasetAvailable: boolean;
}

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  status: ApiStatus;
}

function Wordmark({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 rounded-md"
      aria-label="Sephora Business Insight — Executive Overview"
    >
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-burgundy font-display text-lg text-white"
      >
        S
      </span>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block font-display text-[17px] tracking-[0.02em] text-charcoal">
            Sephora
          </span>
          <span className="block text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-3">
            Business Insight
          </span>
        </span>
      )}
    </Link>
  );
}

function AvailableLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href!}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={`group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors ${
        active
          ? "bg-soft-pink font-medium text-burgundy"
          : "text-ink-2 hover:bg-light-gray hover:text-charcoal"
      } ${collapsed ? "justify-center px-0" : ""}`}
    >
      {active && (
        <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-burgundy" />
      )}
      <Icon aria-hidden className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function PlannedItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <li
      title={`${item.label} — coming soon`}
      className={`flex h-10 cursor-default items-center gap-3 rounded-md px-3 text-sm text-ink-3 ${
        collapsed ? "justify-center px-0" : ""
      }`}
    >
      <Icon aria-hidden className="h-[18px] w-[18px] shrink-0 opacity-70" strokeWidth={1.75} />
      {collapsed ? (
        <span className="sr-only">{item.label} (coming soon)</span>
      ) : (
        <>
          <span className="truncate">
            {item.label}
            <span className="sr-only"> (coming soon, not yet available)</span>
          </span>
          <span
            aria-hidden
            className="ml-auto shrink-0 rounded-full border border-line px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wider text-ink-3"
          >
            Soon
          </span>
        </>
      )}
    </li>
  );
}

export function Sidebar({ collapsed = false, onToggleCollapsed, onNavigate, status }: SidebarProps) {
  const pathname = usePathname();
  const statusText = !status.connected
    ? "API offline"
    : status.datasetAvailable
      ? "Live data connected"
      : "Dataset not found";
  const statusOk = status.connected && status.datasetAvailable;

  return (
    <div className="flex h-full flex-col">
      <div className={`flex h-16 items-center ${collapsed ? "justify-center px-2" : "px-5"}`}>
        <Wordmark collapsed={collapsed} />
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
        {!collapsed && (
          <p className="px-3 pb-2 pt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">
            Analytics
          </p>
        )}
        <ul className={`space-y-1 ${collapsed ? "pt-4" : ""}`}>
          {AVAILABLE_ITEMS.map((item) => (
            <li key={item.label}>
              <AvailableLink
                item={item}
                active={isActive(item, pathname)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>

        {PLANNED_ITEMS.length > 0 && (
          <>
            {collapsed ? (
              <hr className="mx-3 my-4 border-line" />
            ) : (
              <p className="px-3 pb-2 pt-7 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">
                Coming next
              </p>
            )}
            <ul className="space-y-1" aria-label="Planned sections (not yet available)">
              {PLANNED_ITEMS.map((item) => (
                <PlannedItem key={item.label} item={item} collapsed={collapsed} />
              ))}
            </ul>
          </>
        )}
      </nav>

      <div className="border-t border-line px-3 py-3">
        <div
          className={`flex items-center gap-2.5 px-3 py-2 text-xs text-ink-2 ${collapsed ? "justify-center px-0" : ""}`}
          title={statusText}
          role="status"
        >
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full ${statusOk ? "bg-burgundy" : "bg-ink-3"}`}
          />
          {collapsed ? <span className="sr-only">{statusText}</span> : statusText}
        </div>
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={`mt-1 flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm text-ink-2 transition-colors hover:bg-light-gray hover:text-charcoal ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
            ) : (
              <>
                <PanelLeftClose aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
                Collapse
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
