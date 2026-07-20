import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublicInvoiceView } from "@/components/invoices/public-invoice-view";

export const metadata: Metadata = { title: "Invoice" };

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("*, client:clients(*), profile:profiles!invoices_user_id_fkey(*)")
    .eq("public_token", token)
    .single();

  if (!invoice || !invoice.client || !invoice.profile) notFound();

  // First open after being sent flips it to "viewed" — but only ever
  // forward (sent -> viewed), never backward over "paid" or "overdue", and
  // only once (viewed_at stays put on subsequent visits).
  if (invoice.status === "sent") {
    await admin
      .from("invoices")
      .update({ status: "viewed", viewed_at: invoice.viewed_at ?? new Date().toISOString() })
      .eq("id", invoice.id);
    invoice.status = "viewed";
  }

  const { data: items } = await admin
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoice.id)
    .order("sort_order");

  const { data: messages } = await admin
    .from("invoice_messages")
    .select("*")
    .eq("invoice_id", invoice.id)
    .order("created_at");

  return (
    <PublicInvoiceView
      invoice={invoice}
      client={invoice.client}
      profile={invoice.profile}
      items={items ?? []}
      messages={messages ?? []}
      token={token}
    />
  );
}
