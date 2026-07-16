import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Server Actions, and Route
 * Handlers. Reads the session from cookies via Next's async `cookies()`
 * API.
 *
 * The `setAll` write is wrapped in try/catch because Server Components are
 * read-only with respect to cookies — only Server Actions, Route Handlers,
 * and middleware can set them. middleware.ts is what actually refreshes
 * the session cookie on every request; this try/catch just stops a Server
 * Component render from throwing when the underlying client attempts a
 * routine token refresh write.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render — safe to ignore.
          }
        },
      },
    }
  );
}
