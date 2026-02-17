"use client";

import React, { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

/* ── Types ────────────────────────────────────────────────────────────── */

export interface FilterConfig {
  /** Query parameter name */
  key: string;
  /** Display label */
  label: string;
  /** Filter type */
  type: "select" | "search";
  /** Options for select filters */
  options?: { value: string; label: string }[];
  /** Placeholder text */
  placeholder?: string;
  /** CSS width class */
  width?: string;
}

interface FilterBarProps {
  /** Filter configuration */
  filters: FilterConfig[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * URL-persisted filter bar.
 *
 * Reads filter values from URL search params and writes them back on change.
 * This means filters survive page refresh and can be shared via URL.
 *
 * Usage:
 *   <FilterBar filters={[
 *     { key: "status", label: "Status", type: "select", options: [...] },
 *     { key: "q", label: "Search", type: "search", placeholder: "Search..." },
 *   ]} />
 */
export function FilterBar({ filters, className = "" }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset to page 1 when filters change
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const clearAll = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  const hasActiveFilters = filters.some(
    (f) => searchParams.get(f.key),
  );

  return (
    <div className={`card ${className}`}>
      <div className="flex flex-wrap items-end gap-4">
        {filters.map((filter) =>
          filter.type === "select" ? (
            <div key={filter.key} className={`w-full sm:w-auto ${filter.width ?? ""}`}>
              <label
                htmlFor={`filter-${filter.key}`}
                className="label"
              >
                {filter.label}
              </label>
              <select
                id={`filter-${filter.key}`}
                value={searchParams.get(filter.key) ?? ""}
                onChange={(e) => setParam(filter.key, e.target.value)}
                className={`input-field w-full ${filter.width ?? "sm:w-48"}`}
              >
                <option value="">{filter.placeholder ?? `All ${filter.label}`}</option>
                {filter.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <SearchFilter
              key={filter.key}
              filter={filter}
              value={searchParams.get(filter.key) ?? ""}
              onSubmit={(v) => setParam(filter.key, v)}
              width={filter.width}
            />
          ),
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 focus-ring rounded px-2 py-1"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Search sub-component ─────────────────────────────────────────────── */

function SearchFilter({
  filter,
  value,
  onSubmit,
  width,
}: {
  filter: FilterConfig;
  value: string;
  onSubmit: (v: string) => void;
  width?: string;
}) {
  const [input, setInput] = React.useState(value);

  // Sync external changes
  React.useEffect(() => {
    setInput(value);
  }, [value]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(input);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex items-end gap-2 w-full sm:w-auto ${width ?? ""}`}
    >
      <div className="flex-1 sm:flex-none">
        <label htmlFor={`filter-${filter.key}`} className="label">
          {filter.label}
        </label>
        <input
          id={`filter-${filter.key}`}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={filter.placeholder}
          className={`input-field w-full ${width ?? "sm:w-64"}`}
        />
      </div>
      <button type="submit" className="btn-secondary">
        Search
      </button>
    </form>
  );
}

export default FilterBar;
