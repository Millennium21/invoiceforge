import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY service-role client. Bypasses Row Level Security entirely.
 *
 * Never import this from a Client Component, and never expose
 * SUPABASE_SERVICE_ROLE_KEY through a NEXT_PUBLIC_ variable. Legitimate
 * uses in this codebase are narrow and explicit:
 *
 *  - looking up a public invoice by its opaque `public_token` for the
 *    client-facing /invoice/[token] page (there's no user session to
 *    authenticate there, and deliberately no public RLS policy either —
 *    see the note in supabase/migrations/0003_invoices.sql)
 *  - the Stripe webhook handler, which has no user session
 *  - GDPR account export/deletion, which needs to read/delete across a
 *    user's full data footprint in one place
 *  - the scheduled Edge Functions (reminders, recurring invoice generation)
 *
 * Every query made with this client filters explicitly by an id or token
 * the caller has already proven they hold — it does not do tenant
 * isolation for you the way RLS does.
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. This is required for admin/public-token access paths."
    );
  }

  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
