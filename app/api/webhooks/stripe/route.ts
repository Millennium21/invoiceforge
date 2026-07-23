import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInvoiceEmail } from "@/lib/resend";
import { captureServerEvent } from "@/lib/analytics";
import type { SupabaseClient } from "@supabase/supabase-js";

// Stripe's SDK needs Node APIs (crypto) for signature verification — this
// route cannot run on the Edge runtime.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Idempotency: Stripe explicitly documents that the same event can be
  // delivered more than once. This turns "process an event" into an
  // atomic insert-or-detect-duplicate on event.id — a retried delivery
  // becomes a safe no-op instead of double-crediting a payment or sending
  // a client a second receipt email.
  const { error: dedupeError } = await supabase
    .from("processed_stripe_events")
    .insert({ id: event.id, type: event.type });

  if (dedupeError) {
    if (dedupeError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Failed to record Stripe event, processing anyway", dedupeError);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "payment" && session.metadata?.invoice_id) {
          await handleInvoicePaid(supabase, session);
        } else if (session.mode === "subscription") {
          await handleSubscriptionCheckout(supabase, session);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscriptionFromStripe(supabase, subscription);
        break;
      }
      default:
        break; // Unhandled event types are intentionally ignored, not errors.
    }
  } catch (err) {
    console.error(`Error handling Stripe event ${event.type} (${event.id})`, err);
    // Non-2xx tells Stripe to retry with backoff — safe because of the
    // idempotency guard above.
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleInvoicePaid(supabase: SupabaseClient, session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata!.invoice_id;

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, client:clients(*), profile:profiles!invoices_user_id_fkey(*)")
    .eq("id", invoiceId)
    .single();

  if (!invoice) {
    console.error(`Webhook: invoice ${invoiceId} not found for checkout session ${session.id}`);
    return;
  }

  await supabase
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    })
    .eq("id", invoiceId);

  await supabase.from("payments").insert({
    invoice_id: invoiceId,
    user_id: invoice.user_id,
    amount_pence: session.amount_total ?? invoice.total_pence,
    currency: (session.currency ?? invoice.currency).toUpperCase(),
    stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    stripe_checkout_session_id: session.id,
    status: "succeeded",
  });

  captureServerEvent(invoice.user_id, "invoice_paid", { invoice_id: invoiceId, amount_pence: invoice.total_pence });

  if (invoice.client?.email) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    try {
      await sendInvoiceEmail({
        to: invoice.client.email,
        businessName: invoice.profile?.business_name || invoice.profile?.full_name || "Your freelancer",
        invoiceNumber: invoice.invoice_number,
        amountFormatted: (invoice.total_pence / 100).toFixed(2),
        dueDateFormatted: invoice.due_date,
        publicUrl: `${siteUrl}/invoice/${invoice.public_token}`,
        kind: "paid",
      });
    } catch (err) {
      // Payment is already recorded — a failed receipt email must not
      // fail the webhook (Stripe would retry and we'd double-process).
      console.error("Failed to send payment receipt email", err);
    }
  }
}

async function handleSubscriptionCheckout(supabase: SupabaseClient, session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id;
  const tier = session.metadata?.tier;
  if (!userId || !session.subscription) return;

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

  await supabase
    .from("subscriptions")
    .update({
      stripe_subscription_id: subscription.id,
      tier: tier ?? "starter",
      status: subscription.status,
      current_period_end: new Date(subscription.items.data[0].current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq("user_id", userId);

  captureServerEvent(userId, "subscription_started", { tier });
}

async function syncSubscriptionFromStripe(supabase: SupabaseClient, subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.error(`Webhook: subscription ${subscription.id} has no supabase_user_id metadata`);
    return;
  }

  const isCanceled = subscription.status === "canceled";

  await supabase
    .from("subscriptions")
    .update({
      tier: isCanceled ? "free" : (subscription.metadata?.tier ?? "starter"),
      status: subscription.status,
      current_period_end: new Date(subscription.items.data[0].current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq("user_id", userId);

  if (isCanceled) captureServerEvent(userId, "subscription_canceled");
}
