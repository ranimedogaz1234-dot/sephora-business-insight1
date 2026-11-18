import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api/client";

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
});
