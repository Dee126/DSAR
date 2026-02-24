import type { HeatmapOverviewResponse } from "../types";

/**
 * Fetch the heatmap overview from the API.
 * Throws a readable error if the request fails.
 */
export async function fetchHeatmapOverview(): Promise<HeatmapOverviewResponse> {
  const res = await fetch("/api/heatmap/overview", {
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return res.json();
}
