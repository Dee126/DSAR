import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Returns true when the required env vars for the browser Supabase client
 * are present. Call this before `createBrowserSupabase()` to avoid warnings.
 */
export function isBrowserSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Creates (or returns the cached) browser-side Supabase client.
 * Returns `null` when the required env vars are missing instead of throwing,
 * so callers can gracefully fall back to other data sources.
 */
export function createBrowserSupabase(): SupabaseClient | null {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn(
      "[supabase/browser] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set — Supabase client unavailable"
    );
    return null;
  }

  client = createClient(url, anonKey);
  return client;
}
