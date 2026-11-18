import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, toQueryString } from "@/lib/api/client";

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("calls the versioned endpoint and returns typed JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await api.health();

    expect(res.status).toBe("ok");
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/v1\/health$/);
  });

  it("raises ApiError with the backend detail on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Dataset not available" }), { status: 503 }),
      ),
    );

    await expect(api.overview()).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      message: "Dataset not available",
    });
    await expect(api.overview()).rejects.toBeInstanceOf(ApiError);
  });

  it("never echoes a non-string error detail (e.g. validation arrays)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: [{ loc: ["query", "year"] }] }), {
          status: 422,
          statusText: "Unprocessable Content",
        }),
      ),
    );
    await expect(api.kpis()).rejects.toMatchObject({ status: 422, message: "Unprocessable Content" });
  });

  it("sends review filters with repeated keys and drops empty values", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await api.topProductsByYear(2021, {
      date_from: "2021-01-01",
      date_to: undefined,
      brand: ["CLINIQUE", "fresh"],
      subcategory: [],
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/api/v1/products/top-by-year");
    expect(url.searchParams.getAll("brand")).toEqual(["CLINIQUE", "fresh"]);
    expect(url.searchParams.get("date_from")).toBe("2021-01-01");
    expect(url.searchParams.has("date_to")).toBe(false);
    expect(url.searchParams.has("subcategory")).toBe(false);
    expect(url.searchParams.get("year")).toBe("2021");
    expect(url.searchParams.get("limit")).toBe("10");
  });
});

describe("toQueryString", () => {
  it("encodes special characters and booleans", () => {
    expect(toQueryString({ brand: ["Dr. Jart+"], recommended: true })).toBe(
      "?brand=Dr.+Jart%2B&recommended=true",
    );
    expect(toQueryString({})).toBe("");
    expect(toQueryString({ a: null, b: "" })).toBe("");
  });
});
