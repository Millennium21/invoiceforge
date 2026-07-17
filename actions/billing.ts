"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripe, STRIPE_PRICE_IDS } from "@/lib/stripe";
import { PAYMENTS_ENABLED } from "@/lib/payments";
import type { ActionResult } from "@/actions/clients";

export async function createCheckoutSessionAction(tier: "starter" | "pro"): Promise<ActionResult> {
  if (!PAYMENTS_ENABLED) {
    return { success: false, error: "Payments are disabled — every feature is already unlocked for free." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  let customerId = subscription?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabase.from("subscriptions").update({ stripe_customer_id: customerId }).eq("user_id", user.id);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create(
    {
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: STRIPE_PRICE_IDS[tier], quantity: 1 }],
      success_url: `${siteUrl}/settings/billing?checkout=success`,
      cancel_url: `${siteUrl}/settings/billing?checkout=cancelled`,
      metadata: { supabase_user_id: user.id, tier },
      subscription_data: { metadata: { supabase_user_id: user.id, tier } },
    },
    // Idempotency key: if the browser retries this action (double-click,
    // flaky network), Stripe returns the SAME session instead of creating
    // a second one — safe to retry blindly, unlike most payment calls.
    { idempotencyKey: `checkout-${user.id}-${tier}-${Date.now().toString().slice(0, -4)}` }
  );

  if (!session.url) return { success: false, error: "Stripe did not return a checkout URL." };
  redirect(session.url);
}

export async function createPortalSessionAction(): Promise<ActionResult> {
  if (!PAYMENTS_ENABLED) {
    return { success: false, error: "Payments are disabled — there's no subscription to manage." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!subscription?.stripe_customer_id) {
    return { success: false, error: "No billing account found yet — subscribe to a plan first." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${siteUrl}/settings/billing`,
  });

  redirect(session.url);
}
