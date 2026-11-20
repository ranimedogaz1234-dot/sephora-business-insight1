import { describe, expect, it } from "vitest";
import {
  addProduct,
  canCompare,
  compareHref,
  parseCompareState,
  parseIds,
  removeProduct,
  toCompareSearchParams,
  type CompareState,
} from "@/lib/compareState";

describe("parseIds", () => {
  it("keeps valid, distinct IDs in order and caps at four", () => {
    expect(parseIds("P3, P1,P3,bad,P2;x,P4,P5")).toEqual(["P3", "P1", "P4", "P5"]);
  });
  it("handles empty input", () => {
    expect(parseIds(undefined)).toEqual([]);
    expect(parseIds("")).toEqual([]);
  });
});

describe("compare state", () => {
  it("parses ids, search and granularity", () => {
    expect(parseCompareState({ ids: "P1,P2", find: " serum ", grain: "quarter" })).toEqual({
      ids: ["P1", "P2"],
      find: "serum",
      grain: "quarter",
    });
    expect(parseCompareState({ grain: "month", find: "a" })).toEqual({ ids: [], find: undefined, grain: "year" });
  });

  it("round-trips through the URL and omits defaults", () => {
    const s = { ids: ["P1", "P2"], find: "glow", grain: "quarter" as const };
    expect(parseCompareState(Object.fromEntries(toCompareSearchParams(s)))).toEqual(s);
    expect(compareHref({ ids: [], grain: "year" })).toBe("/compare");
    expect(compareHref({ ids: ["P1", "P2"], grain: "year" })).toBe("/compare?ids=P1%2CP2");
  });

  it("adds products up to four, never duplicates, and removes", () => {
    let s: CompareState = { ids: ["P1"], grain: "year" };
    s = addProduct(s, "P2");
    expect(addProduct(s, "P2").ids).toEqual(["P1", "P2"]);
    s = addProduct(addProduct(s, "P3"), "P4");
    expect(addProduct(s, "P5").ids).toEqual(["P1", "P2", "P3", "P4"]);
    expect(addProduct({ ids: [], grain: "year" }, "not-an-id").ids).toEqual([]);
    expect(removeProduct(s, "P2").ids).toEqual(["P1", "P3", "P4"]);
  });

  it("needs at least two products", () => {
    expect(canCompare({ ids: ["P1"], grain: "year" })).toBe(false);
    expect(canCompare({ ids: ["P1", "P2"], grain: "year" })).toBe(true);
  });
});
