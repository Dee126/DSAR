export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import {
  forecastMetric,
  forecastDsarVolume,
  slBreachProbability,
  incidentSurgeMultiplier,
} from "@/lib/forecast-service";

/**
 * GET /api/executive/forecasts — Get forecasting data
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforce(user.role, "EXEC_FORECAST_VIEW");

    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "all";
    const metric = url.searchParams.get("metric");
    const months = parseInt(url.searchParams.get("months") ?? "3", 10);

    if (type === "metric" && metric) {
      const forecast = await forecastMetric(user.tenantId, metric, months);
      return NextResponse.json(forecast);
    }

    if (type === "breach") {
      const breach = await slBreachProbability(user.tenantId);
      return NextResponse.json(breach);
    }

    if (type === "surge") {
      const surge = await incidentSurgeMultiplier(user.tenantId);
      return NextResponse.json(surge);
    }

    // type === "all" — return comprehensive forecast
    const [dsarVolume, breach, surge] = await Promise.all([
      forecastDsarVolume(user.tenantId, months),
      slBreachProbability(user.tenantId),
      incidentSurgeMultiplier(user.tenantId),
    ]);

    return NextResponse.json({
      dsarVolume,
      slBreachProbability: breach,
      incidentSurgeMultiplier: surge,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
