"use client";

import React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

/* ── Types ────────────────────────────────────────────────────────────── */

export interface ColumnDef<T> {
  /** Unique key for this column */
  key: string;
  /** Column header label */
  header: string;
  /** Render cell content */
  cell: (row: T) => React.ReactNode;
  /** Additional header CSS */
  headerClass?: string;
  /** Additional cell CSS */
  cellClass?: string;
  /** Hide on mobile */
  hideOnMobile?: boolean;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface DataTableProps<T> {
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Data rows */
  data: T[];
  /** Unique key extractor */
  rowKey: (row: T) => string;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Pagination info (if paginated) */
  pagination?: PaginationInfo;
  /** Mobile card renderer (optional, for responsive tables) */
  mobileCard?: (row: T) => React.ReactNode;
  /** Additional CSS classes for wrapper */
  className?: string;
}

/**
 * Reusable data table with URL-persisted pagination.
 *
 * Features:
 * - Desktop table + optional mobile card layout
 * - URL-persisted page parameter
 * - Accessible headers and keyboard navigation
 *
 * Usage:
 *   <DataTable
 *     columns={[
 *       { key: "name", header: "Name", cell: (r) => r.name },
 *       { key: "status", header: "Status", cell: (r) => <DataBadge label={r.status} variant="status" /> },
 *     ]}
 *     data={items}
 *     rowKey={(r) => r.id}
 *     onRowClick={(r) => router.push(`/items/${r.id}`)}
 *     pagination={{ page: 1, pageSize: 20, total: 100, totalPages: 5 }}
 *   />
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  pagination,
  mobileCard,
  className = "",
}: DataTableProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setPage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(newPage));
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className={`card p-0 ${className}`}>
      {/* Desktop Table */}
      <div className={`${mobileCard ? "hidden md:block" : ""} overflow-x-auto`}>
        <table className="w-full" role="grid">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-6 py-3 ${col.hideOnMobile ? "hidden md:table-cell" : ""} ${col.headerClass ?? ""}`}
                  scope="col"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? "cursor-pointer transition-colors hover:bg-gray-50" : ""}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? "link" : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-6 py-4 ${col.hideOnMobile ? "hidden md:table-cell" : ""} ${col.cellClass ?? ""}`}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      {mobileCard && (
        <div className="divide-y divide-gray-200 md:hidden">
          {data.map((row) => (
            <div key={rowKey(row)}>{mobileCard(row)}</div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 px-6 py-4">
          <p className="text-sm text-gray-500">
            Showing{" "}
            <span className="font-medium">
              {(pagination.page - 1) * pagination.pageSize + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium">
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}
            </span>{" "}
            of <span className="font-medium">{pagination.total}</span> results
          </p>
          <div className="flex gap-2" role="navigation" aria-label="Pagination">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setPage(pagination.page - 1)}
              className="btn-secondary text-sm"
              aria-label="Previous page"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(pagination.page + 1)}
              className="btn-secondary text-sm"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
