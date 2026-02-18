import { createBrowserClient as createSupaBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createSupaBrowserClient> | null = null;

export function createBrowserClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  client = createSupaBrowserClient(url, anonKey);
  return client;
}
