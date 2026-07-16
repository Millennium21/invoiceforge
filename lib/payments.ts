import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionTier } from "@/types";

/**
 * Zero-Cost Mode.
 *
 * ENABLE_PAYMENTS=false (the default): every feature is unlocked for every
 * user, no limits, no paywalls, no Stripe subscription calls are ever
 * made. You can deploy and run the whole app on Vercel + Supabase free
 * tiers indefinitely at £0/month.
 *
 * ENABLE_PAYMENTS=true: the freemium model activates — the limits in
 * TIER_LIMITS below are enforced, and the pricing/upgrade UI appears.
 *
 * To flip it: set ENABLE_PAYMENTS=true in .env.local (dev) or in your
 * Vercel project's Environment Variables (production), then redeploy —
 * env vars are baked in at build/boot time, so a running dev server needs
 * a restart and a Vercel deployment needs a redeploy for the change to
 * take effect. See README "Toggling ENABLE_PAYMENTS" for the full steps.
 */
export const PAYMENTS_ENABLED = process.env.ENABLE_PAYMENTS === "true";

export const TIER_LIMITS: Record<
  SubscriptionTier,
  { maxInvoicesPerMonth: number | null; customBranding: boolean; advancedReports: boolean }
> = {
  free: { maxInvoicesPerMonth: 10, customBranding: false, advancedReports: false },
  starter: { maxInvoicesPerMonth: null, customBranding: true, advancedReports: false },
  pro: { maxInvoicesPerMonth: null, customBranding: true, advancedReports: true },
};

export interface InvoiceLimitCheck {
  allowed: boolean;
  reason?: string;
  invoicesThisMonth?: number;
  limit?: number | null;
}

/**
 * Called from the createInvoice server action before every insert. When
 * payments are disabled this is a guaranteed-cheap early return — it never
 * even queries the database, let alone Stripe.
 */
export async function canCreateInvoice(
  supabase: SupabaseClient,
  userId: string
): Promise<InvoiceLimitCheck> {
  if (!PAYMENTS_ENABLED) return { allowed: true };

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("tier, status")
    .eq("user_id", userId)
    .single();

  const tier: SubscriptionTier = sub && sub.status === "active" ? sub.tier : "free";
  const limit = TIER_LIMITS[tier].maxInvoicesPerMonth;

  if (limit === null) return { allowed: true, limit: null };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  const invoicesThisMonth = count ?? 0;

  if (invoicesThisMonth >= limit) {
    return {
      allowed: false,
      reason: `You've reached the free plan's limit of ${limit} invoices this month. Upgrade to Starter for unlimited invoices.`,
      invoicesThisMonth,
      limit,
    };
  }

  return { allowed: true, invoicesThisMonth, limit };
}

export function canUseCustomBranding(tier: SubscriptionTier): boolean {
  if (!PAYMENTS_ENABLED) return true;
  return TIER_LIMITS[tier].customBranding;
}

export function canUseAdvancedReports(tier: SubscriptionTier): boolean {
  if (!PAYMENTS_ENABLED) return true;
  return TIER_LIMITS[tier].advancedReports;
}
