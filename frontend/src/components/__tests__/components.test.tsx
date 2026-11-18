import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BarChartCard } from "@/components/charts/BarChartCard";
import { KpiCard } from "@/components/ui/KpiCard";

describe("KpiCard", () => {
  it("renders label, value and source", () => {
    render(<KpiCard label="Reviews" value="1,234" source="Review records" />);
    expect(screen.getByText("Reviews")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("Review records")).toBeInTheDocument();
  });
});

describe("BarChartCard", () => {
  it("renders an accessible chart region when data is present", () => {
    render(<BarChartCard title="Synthetic chart" data={[{ label: "A", value: 3 }]} />);
    expect(screen.getByRole("img", { name: "Synthetic chart" })).toBeInTheDocument();
  });

  it("shows an empty state without data", () => {
    render(<BarChartCard title="Empty" data={[]} />);
    expect(screen.getByText("No data available.")).toBeInTheDocument();
  });
});
