import { config } from "@/lib/config";
import type { HealthResponse, OverviewResponse } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${config.apiBaseUrl}${config.apiPrefix}${path}`;
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail || `Request failed: ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => apiGet<HealthResponse>("/health"),
  overview: () => apiGet<OverviewResponse>("/overview"),
};
