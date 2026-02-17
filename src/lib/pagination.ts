/**
 * Pagination — Standardized pagination defaults & helpers
 *
 * Enforces max page sizes across all list endpoints.
 */

export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 50;

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

/**
 * Parse and clamp pagination parameters from request.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaults?: { pageSize?: number; maxPageSize?: number },
): PaginationParams {
  const maxSize = defaults?.maxPageSize ?? PAGE_SIZE_MAX;
  const defaultSize = defaults?.pageSize ?? PAGE_SIZE_DEFAULT;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const rawSize = parseInt(
    searchParams.get("pageSize") ?? searchParams.get("limit") ?? String(defaultSize),
    10,
  );
  const pageSize = Math.min(maxSize, Math.max(1, rawSize));
  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip, take: pageSize };
}

/**
 * Build standard pagination response metadata.
 */
export function paginationMeta(total: number, params: PaginationParams) {
  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.ceil(total / params.pageSize),
  };
}
