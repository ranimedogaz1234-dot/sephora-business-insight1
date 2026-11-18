/** Frontend runtime configuration. Values come from NEXT_PUBLIC_* env vars (see .env.example). */
export const config = {
  apiBaseUrl: (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, ""),
  apiPrefix: "/api/v1",
} as const;
