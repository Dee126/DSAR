"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface SearchResult {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  snippet: string;
  metadata: Record<string, unknown>;
  deepLink: string;
}

const ENTITY_BADGES: Record<string, { label: string; color: string }> = {
  CASE: { label: "Case", color: "bg-blue-100 text-blue-700" },
  INCIDENT: { label: "Incident", color: "bg-red-100 text-red-700" },
  VENDOR_REQUEST: { label: "Vendor", color: "bg-purple-100 text-purple-700" },
  DOCUMENT: { label: "Document", color: "bg-green-100 text-green-700" },
  SYSTEM: { label: "System", color: "bg-orange-100 text-orange-700" },
  INTAKE: { label: "Intake", color: "bg-teal-100 text-teal-700" },
  RESPONSE: { label: "Response", color: "bg-indigo-100 text-indigo-700" },
  AUDIT: { label: "Audit", color: "bg-gray-100 text-gray-700" },
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { data: session } = useSession();
  const debounceRef = useRef<NodeJS.Timeout>();

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("pp-recent-searches");
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
    }
  }, [open]);

  // Search debounce
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&pageSize=8`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
        setSelectedIdx(0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  function navigateTo(link: string, q?: string) {
    if (q) {
      const recent = [q, ...recentSearches.filter((r) => r !== q)].slice(0, 5);
      setRecentSearches(recent);
      try { localStorage.setItem("pp-recent-searches", JSON.stringify(recent)); } catch {}
    }
    setOpen(false);
    router.push(link);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIdx]) {
        navigateTo(results[selectedIdx].deepLink, query);
      } else if (query.trim()) {
        navigateTo(`/search?q=${encodeURIComponent(query)}`);
      }
    }
  }

  if (!session) return null;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500 sm:inline">
          {typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "\u2318" : "Ctrl+"}K
        </kbd>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

          {/* Palette */}
          <div className="relative w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-2xl">
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search cases, incidents, vendors, documents..."
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
              />
              {loading && (
                <svg className="h-4 w-4 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              <kbd className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-400">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {results.length > 0 ? (
                <ul className="py-2">
                  {results.map((r, idx) => {
                    const badge = ENTITY_BADGES[r.entityType] ?? { label: r.entityType, color: "bg-gray-100 text-gray-600" };
                    return (
                      <li key={r.id}>
                        <button
                          onClick={() => navigateTo(r.deepLink, query)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            idx === selectedIdx ? "bg-brand-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${badge.color}`}>
                            {badge.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">{r.title}</p>
                            <p className="truncate text-xs text-gray-500">{r.snippet}</p>
                          </div>
                          {r.metadata?.status && (
                            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                              {String(r.metadata.status)}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : query.trim() && !loading ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No results found for &quot;{query}&quot;
                </div>
              ) : !query.trim() ? (
                <div className="py-2">
                  {recentSearches.length > 0 && (
                    <div className="px-4 py-2">
                      <p className="text-xs font-medium uppercase text-gray-400">Recent Searches</p>
                      <ul className="mt-1 space-y-1">
                        {recentSearches.map((rs) => (
                          <li key={rs}>
                            <button
                              onClick={() => { setQuery(rs); doSearch(rs); }}
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                            >
                              <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                              </svg>
                              {rs}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="px-4 py-2">
                    <p className="text-xs font-medium uppercase text-gray-400">Quick Links</p>
                    <ul className="mt-1 space-y-1">
                      {[
                        { label: "Full Search Page", href: "/search" },
                        { label: "eDiscovery", href: "/ediscovery" },
                        { label: "Saved Searches", href: "/search?tab=saved" },
                      ].map((l) => (
                        <li key={l.href}>
                          <button
                            onClick={() => navigateTo(l.href)}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                          >
                            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                            {l.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            {query.trim() && results.length > 0 && (
              <div className="border-t border-gray-200 px-4 py-2">
                <button
                  onClick={() => navigateTo(`/search?q=${encodeURIComponent(query)}`)}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  View all results &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
