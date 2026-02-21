import "server-only";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Returns true when Supabase is enabled via the USE_SUPABASE feature flag
 * and the required env vars are present. When USE_SUPABASE is "false" or
 * unset, the MVP uses Prisma/Postgres directly.
 */
export function isSupabaseEnabled(): boolean {
  if (process.env.USE_SUPABASE === "false") return false;
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Returns the server-side Supabase client using the service-role key
 * (bypasses RLS). Throws if Supabase is disabled or the required env vars
 * are missing.
 *
 * The client is cached as a module-level singleton so it can be reused
 * across repository calls within the same server process.
 */
export function supabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  if (!isSupabaseEnabled()) {
    throw new Error(
      "[supabase-admin] Supabase is disabled (USE_SUPABASE=false or env vars missing). " +
        "The MVP uses Prisma/Postgres directly. Set USE_SUPABASE=true and configure " +
        "NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to enable Supabase."
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  _client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _client;
}
