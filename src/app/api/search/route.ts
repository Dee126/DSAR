import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforce, has } from "@/lib/rbac";
import { handleApiError } from "@/lib/errors";
import { searchQuerySchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { getDeepLink } from "@/lib/search-index-service";
import { SearchEntityType, Prisma } from "@prisma/client";
import { PAGE_SIZE_MAX } from "@/lib/pagination";
import { cache, cacheKey, CacheTTL } from "@/lib/cache-service";
import { createRequestProfiler, recordEndpointDiagnostics } from "@/lib/query-profiler";

// Scope → entity type mapping
const SCOPE_MAP: Record<string, SearchEntityType[]> = {
  ALL: ["CASE", "INCIDENT", "VENDOR_REQUEST", "DOCUMENT", "SYSTEM", "INTAKE", "RESPONSE", "AUDIT"],
  CASES: ["CASE"],
  INCIDENTS: ["INCIDENT"],
  VENDORS: ["VENDOR_REQUEST"],
  DOCUMENTS: ["DOCUMENT"],
  SYSTEMS: ["SYSTEM"],
  INTAKE: ["INTAKE"],
  RESPONSES: ["RESPONSE"],
  AUDIT: ["AUDIT"],
};

function buildSnippet(bodyText: string, query: string, maxLen = 200): string {
  if (!query || !bodyText) return bodyText.substring(0, maxLen);
  const lower = bodyText.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return bodyText.substring(0, maxLen);
  const start = Math.max(0, idx - 60);
  const end = Math.min(bodyText.length, idx + query.length + 100);
  let snippet = bodyText.substring(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < bodyText.length) snippet = snippet + "...";
  return snippet;
}

export async function GET(request: NextRequest) {
  const profiler = createRequestProfiler();
  try {
    const user = await requireAuth();
    enforce(user.role, "SEARCH_GLOBAL");

    const url = request.nextUrl;
    const rawPageSize = parseInt(url.searchParams.get("pageSize") ?? "20");
    const rawInput = {
      q: url.searchParams.get("q") ?? "",
      scope: url.searchParams.get("scope") ?? "ALL",
      filters: {
        dateFrom: url.searchParams.get("dateFrom") ?? undefined,
        dateTo: url.searchParams.get("dateTo") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        requestType: url.searchParams.get("requestType") ?? undefined,
        subjectType: url.searchParams.get("subjectType") ?? undefined,
        risk: url.searchParams.get("risk") ?? undefined,
        owner: url.searchParams.get("owner") ?? undefined,
        tags: url.searchParams.get("tags")?.split(",").filter(Boolean) ?? undefined,
        incidentLinked: url.searchParams.get("incidentLinked") === "true" ? true : undefined,
        vendorOverdue: url.searchParams.get("vendorOverdue") === "true" ? true : undefined,
        system: url.searchParams.get("system") ?? undefined,
      },
      page: parseInt(url.searchParams.get("page") ?? "1"),
      pageSize: Math.min(rawPageSize, PAGE_SIZE_MAX),
      sort: url.searchParams.get("sort") ?? "relevance",
    };

    const input = searchQuerySchema.parse(rawInput);

    // Determine which entity types to search based on scope + RBAC
    let entityTypes = SCOPE_MAP[input.scope] ?? SCOPE_MAP.ALL;

    // RBAC: VIEWER/READ_ONLY cannot see AUDIT results
    if (!has(user.role, "SEARCH_AUDIT")) {
      entityTypes = entityTypes.filter((t) => t !== "AUDIT");
    }

    // Build WHERE clause
    const where: Prisma.SearchIndexEntryWhereInput = {
      tenantId: user.tenantId,
      entityType: { in: entityTypes },
    };

    // Date filters
    if (input.filters.dateFrom || input.filters.dateTo) {
      where.updatedAt = {};
      if (input.filters.dateFrom) where.updatedAt.gte = new Date(input.filters.dateFrom);
      if (input.filters.dateTo) where.updatedAt.lte = new Date(input.filters.dateTo);
    }

    // Tag filter
    if (input.filters.tags && input.filters.tags.length > 0) {
      where.tags = { hasSome: input.filters.tags };
    }

    // Metadata-based filters (status, risk, owner, requestType, etc.)
    const metaFilters: Prisma.JsonFilter[] = [];
    if (input.filters.status) {
      metaFilters.push({ path: ["status"], equals: input.filters.status });
    }
    if (input.filters.requestType) {
      metaFilters.push({ path: ["type"], equals: input.filters.requestType });
    }
    if (input.filters.owner) {
      metaFilters.push({ path: ["assignedToUserId"], equals: input.filters.owner });
    }

    // FTS query using raw SQL for tsvector or fallback to ILIKE
    let results;
    let total: number;

    const skip = (input.page - 1) * input.pageSize;
    const take = input.pageSize;

    if (input.q && input.q.trim().length > 0) {
      // Use Postgres full-text search via raw query for ranking
      const tsQuery = input.q
        .trim()
        .split(/\s+/)
        .map((w) => w.replace(/[^\w]/g, ""))
        .filter(Boolean)
        .map((w) => `${w}:*`)
        .join(" & ");

      // Build additional WHERE clauses
      const additionalClauses: string[] = [];
      const params: unknown[] = [user.tenantId];
      let paramIdx = 2;

      if (entityTypes.length < 8) {
        const placeholders = entityTypes.map(() => {
          paramIdx++;
          return `$${paramIdx - 1}::\"SearchEntityType\"`;
        });
        additionalClauses.push(`"entityType" IN (${placeholders.join(",")})`);
        params.push(...entityTypes);
      }

      if (input.filters.dateFrom) {
        additionalClauses.push(`"updatedAt" >= $${paramIdx}::timestamp`);
        params.push(new Date(input.filters.dateFrom));
        paramIdx++;
      }
      if (input.filters.dateTo) {
        additionalClauses.push(`"updatedAt" <= $${paramIdx}::timestamp`);
        params.push(new Date(input.filters.dateTo));
        paramIdx++;
      }
      if (input.filters.tags && input.filters.tags.length > 0) {
        additionalClauses.push(`"tags" && $${paramIdx}::text[]`);
        params.push(input.filters.tags);
        paramIdx++;
      }
      if (input.filters.status) {
        additionalClauses.push(`"metadataJson"->>'status' = $${paramIdx}`);
        params.push(input.filters.status);
        paramIdx++;
      }
      if (input.filters.owner) {
        additionalClauses.push(`"metadataJson"->>'assignedToUserId' = $${paramIdx}`);
        params.push(input.filters.owner);
        paramIdx++;
      }

      const whereClause = additionalClauses.length > 0
        ? `AND ${additionalClauses.join(" AND ")}`
        : "";

      // Sort
      let orderClause = `ts_rank(fts_vector, to_tsquery('english', $${paramIdx})) DESC`;
      if (input.sort === "updated_at") orderClause = `"updatedAt" DESC`;
      if (input.sort === "due_date") orderClause = `("metadataJson"->>'dueDate') ASC NULLS LAST`;
      params.push(tsQuery);
      const tsParamIdx = paramIdx;
      paramIdx++;

      params.push(take, skip);

      // Count query
      const countQuery = `
        SELECT COUNT(*)::int as count
        FROM search_index_entries
        WHERE "tenantId" = $1
          AND fts_vector @@ to_tsquery('english', $${tsParamIdx})
          ${whereClause}
      `;

      const countResult = await prisma.$queryRawUnsafe<{ count: number }[]>(
        countQuery,
        ...params.slice(0, -2)
      );
      total = countResult[0]?.count ?? 0;

      // Main query
      const mainQuery = `
        SELECT id, "tenantId", "entityType", "entityId", title, "bodyText", tags,
               "metadataJson", "updatedAt",
               ts_rank(fts_vector, to_tsquery('english', $${tsParamIdx})) as rank
        FROM search_index_entries
        WHERE "tenantId" = $1
          AND fts_vector @@ to_tsquery('english', $${tsParamIdx})
          ${whereClause}
        ORDER BY ${orderClause}
        LIMIT $${paramIdx - 1} OFFSET $${paramIdx}
      `;

      results = await prisma.$queryRawUnsafe<any[]>(mainQuery, ...params);
    } else {
      // No text query – simple Prisma query with filters
      // Apply metadata filters
      if (metaFilters.length > 0) {
        where.AND = metaFilters.map((f) => ({
          metadataJson: f,
        }));
      }

      const orderBy: Prisma.SearchIndexEntryOrderByWithRelationInput =
        input.sort === "updated_at"
          ? { updatedAt: "desc" }
          : { updatedAt: "desc" };

      [results, total] = await Promise.all([
        prisma.searchIndexEntry.findMany({
          where,
          skip,
          take,
          orderBy,
        }),
        prisma.searchIndexEntry.count({ where }),
      ]);
    }

    // Build response with deep links
    const items = results.map((r: any) => ({
      id: r.id,
      entityType: r.entityType,
      entityId: r.entityId,
      title: r.title,
      snippet: buildSnippet(r.bodyText ?? "", input.q ?? ""),
      metadata: r.metadataJson ?? r.metadataJson,
      tags: r.tags ?? [],
      updatedAt: r.updatedAt,
      deepLink: getDeepLink(
        r.entityType as SearchEntityType,
        r.entityId,
        (typeof r.metadataJson === "object" ? r.metadataJson : {}) as Record<string, unknown>
      ),
      rank: r.rank ?? null,
    }));

    // Build facets (aggregated counts) — cached per tenant
    const facetCk = cacheKey(user.tenantId, "search_facets", { scope: input.scope });
    let facets = await cache.get<Record<string, Record<string, number>>>(facetCk);
    if (!facets) {
      const facetQuery = await prisma.searchIndexEntry.groupBy({
        by: ["entityType"],
        where: { tenantId: user.tenantId, entityType: { in: entityTypes } },
        _count: { _all: true },
      });
      facets = {
        entityType: facetQuery.reduce(
          (acc, f) => ({ ...acc, [f.entityType]: f._count._all }),
          {} as Record<string, number>
        ),
      };
      await cache.set(facetCk, facets, CacheTTL.SEARCH_FACETS);
    }

    recordEndpointDiagnostics("/api/search", profiler);

    return NextResponse.json({
      results: items,
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.ceil(total / input.pageSize),
      facets,
    }, {
      headers: profiler.getHeaders(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
