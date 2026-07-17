"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import type { ActionResult } from "@/actions/clients";

/**
 * Called from the unauthenticated /invoice/[token] page, so it deliberately
 * uses the admin (service-role) client rather than the session-based one —
 * there is no logged-in user here, just proof of possession of the opaque
 * token. Every read is filtered by that token, never by a client-supplied
 * id, which is what makes this safe despite bypassing RLS.
 */
export async function createInvoiceCheckoutAction(token: string): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, client:clients(*), profile:profiles!invoices_user_id_fkey(*)")
    .eq("public_token", token)
    .single();

  if (error || !invoice) return { success: false, error: "Invoice not found." };
  if (invoice.status === "paid") return { success: false, error: "This invoice has already been paid." };
  if (invoice.status === "cancelled") return { success: false, error: "This invoice has been cancelled." };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Single-Stripe-account model: this money settles into the platform
  // owner's Stripe balance, not the freelancer's own bank account. See
  // lib/stripe.ts for the Stripe Connect migration path for true
  // multi-tenant fund routing.
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: invoice.currency.toLowerCase(),
            unit_amount: invoice.total_pence,
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: `${invoice.profile?.business_name || "InvoiceForge"} → ${invoice.client?.name ?? "Client"}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/invoice/${token}/success`,
      cancel_url: `${siteUrl}/invoice/${token}`,
      metadata: { invoice_id: invoice.id, public_token: token },
      customer_email: invoice.client?.email ?? undefined,
    },
    { idempotencyKey: `invoice-checkout-${invoice.id}` }
  );

  if (!session.url) return { success: false, error: "Stripe did not return a checkout URL." };

  await supabase.from("invoices").update({ stripe_checkout_session_id: session.id }).eq("id", invoice.id);

  redirect(session.url);
}
