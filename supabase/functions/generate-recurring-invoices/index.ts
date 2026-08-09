// supabase/functions/generate-recurring-invoices/index.ts
//
// Deploy with: supabase functions deploy generate-recurring-invoices
// Schedule daily, same mechanism as send-invoice-reminders (see README
// "Automated reminders" — the SQL is identical, just a different
// function name/time). All the atomicity, per-template isolation, and
// idempotency-relevant logic lives in the generate_due_recurring_invoices()
// Postgres function (0007_invoice_write_rpc.sql) — this Edge Function is a
// thin wrapper that calls it, then emails whatever got generated. Running
// it twice in the same day is safe: a template's next_invoice_date only
// advances once per real invoice generated, so a second call the same day
// finds nothing due.

import { createClient } from "@supabase/supabase-js";

const RESEND_API_URL = "https://api.resend.com/emails";

interface GeneratedInvoice {
  id: string;
  user_id: string;
  invoice_number: string;
  total_pence: number;
  currency: string;
  due_date: string;
  public_token: string;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "invoices@resend.dev";
  const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:3000";

  const { data: generated, error } = await supabase.rpc("generate_due_recurring_invoices");

  if (error) {
    console.error("generate_due_recurring_invoices RPC failed", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const invoices = (generated ?? []) as GeneratedInvoice[];
  let emailed = 0;
  let failed = 0;

  for (const invoice of invoices) {
    const { data: fullInvoice } = await supabase
      .from("invoices")
      .select("client:clients(email), profile:profiles!invoices_user_id_fkey(business_name,full_name)")
      .eq("id", invoice.id)
      .single();

    const client = fullInvoice?.client as unknown as { email: string | null } | null;
    const profile = fullInvoice?.profile as unknown as { business_name: string | null; full_name: string | null } | null;

    if (!client?.email) continue;

    try {
      const res = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: client.email,
          subject: `Invoice ${invoice.invoice_number} from ${profile?.business_name || profile?.full_name || "your freelancer"}`,
          html: `<p>Your recurring invoice for ${(invoice.total_pence / 100).toFixed(2)} ${invoice.currency} is ready, due ${invoice.due_date}.</p><p><a href="${siteUrl}/invoice/${invoice.public_token}">View and pay</a></p>`,
        }),
      });
      if (!res.ok) throw new Error(`Resend API returned ${res.status}`);
      emailed++;
    } catch (err) {
      console.error(`Failed to email generated invoice ${invoice.id}`, err);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ generated: invoices.length, emailed, failed }),
    { headers: { "Content-Type": "application/json" } }
  );
});
