import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components. Uses the public anon key, which is
 * safe to ship to the browser — Row Level Security is what actually
 * enforces tenant isolation, not secrecy of this key.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
