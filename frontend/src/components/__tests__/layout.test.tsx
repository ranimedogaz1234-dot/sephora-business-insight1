import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import { Sidebar } from "@/components/layout/Sidebar";
import { NAV_ITEMS, isActive } from "@/lib/navigation";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const online = { connected: true, datasetAvailable: true };

describe("Sidebar", () => {
  it("renders only available pages as links, with the active page marked", () => {
    render(<Sidebar status={online} />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/", "/products", "/reviews", "/brands", "/compare"]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[0]).toHaveTextContent("Executive Overview");
    expect(links[1]).toHaveTextContent("Product Analytics");
    expect(links[1]).not.toHaveAttribute("aria-current");
  });

  it("marks Product Analytics active on product detail pages", () => {
    expect(isActive(NAV_ITEMS[1], "/products/P123")).toBe(true);
    expect(isActive(NAV_ITEMS[0], "/products/P123")).toBe(false);
  });

  it("shows every planned section as a non-link 'coming soon' item", () => {
    render(<Sidebar status={online} />);
    const planned = screen.getByRole("list", { name: /planned sections/i });
    const items = within(planned).getAllByRole("listitem");
    const plannedLabels = NAV_ITEMS.filter((i) => i.status === "planned").map((i) => i.label);
    expect(items.map((li) => li.textContent)).toEqual(
      plannedLabels.map((l) => `${l} (coming soon, not yet available)Soon`),
    );
    expect(within(planned).queryAllByRole("link")).toHaveLength(0);
    expect(plannedLabels).not.toContain("Product Analytics");
    expect(plannedLabels).not.toContain("Review Analytics");
    expect(plannedLabels).not.toContain("Brands & Categories");
    expect(plannedLabels).not.toContain("Product Comparison");
    for (const label of [
      "Data Explorer",
      "AI Sentiment Analysis",
    ]) {
      expect(plannedLabels).toContain(label);
    }
  });

  it("keeps labels available to screen readers when collapsed", () => {
    render(<Sidebar status={online} collapsed onToggleCollapsed={() => {}} />);
    expect(screen.getByRole("link", { name: "Executive Overview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
  });

  it("reports API status in words, not color alone", () => {
    const { rerender } = render(<Sidebar status={online} />);
    expect(screen.getByRole("status")).toHaveTextContent("Live data connected");
    rerender(<Sidebar status={{ connected: false, datasetAvailable: false }} />);
    expect(screen.getByRole("status")).toHaveTextContent("API offline");
  });
});

describe("AppShell", () => {
  beforeEach(() => window.localStorage.clear());

  it("collapses the desktop sidebar and remembers the choice", () => {
    render(
      <AppShell status={online}>
        <p>content</p>
      </AppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(window.localStorage.getItem("sbi.sidebar.collapsed")).toBe("1");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });

  it("opens the mobile drawer and closes it with Escape, returning focus", () => {
    render(
      <AppShell status={online}>
        <p>content</p>
      </AppShell>,
    );
    const open = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(open);
    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(open).toHaveFocus();
  });
});
