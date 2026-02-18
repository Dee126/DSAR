import "server-only";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns true when the required env vars for the server Supabase client
 * (service-role) are present. Use this to guard Supabase calls and fall
 * back to Prisma when Supabase is not configured.
 */
export function isServerSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Creates a server-side Supabase client using the service-role key
 * (bypasses RLS). Returns `null` when the required env vars are missing
 * instead of throwing, so callers can fall back to Prisma.
 */
export function createServerSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.warn(
      "[supabase/server] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — Supabase client unavailable"
    );
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
