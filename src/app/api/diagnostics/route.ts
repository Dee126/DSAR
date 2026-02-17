import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { getSlowQueryLog } from "@/lib/query-profiler";
import { cache } from "@/lib/cache-service";

/**
 * GET /api/diagnostics — Dev-only performance diagnostics
 *
 * Returns:
 * - Slow query log (routes exceeding threshold)
 * - Cache stats (hit/miss ratio)
 */
export async function GET() {
  try {
    const user = await requireAuth();
    enforce(user.role, "ASSURANCE_VIEW");

    const slowQueries = getSlowQueryLog();
    const cacheStats = cache.stats();

    return NextResponse.json({
      slowQueries,
      cache: {
        ...cacheStats,
        hitRate: cacheStats.hits + cacheStats.misses > 0
          ? Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100)
          : 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
