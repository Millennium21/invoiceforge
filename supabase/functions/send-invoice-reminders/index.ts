// supabase/functions/send-invoice-reminders/index.ts
//
// Deno Edge Function — deploy with:
//   supabase functions deploy send-invoice-reminders
// Schedule it (daily, e.g. 08:00 UTC) with Supabase's Dashboard > Edge
// Functions > Cron, or via pg_cron calling net.http_post — see README
// "Automated reminders" for the exact SQL. This function is not run by
// this repo's local build; it runs on Supabase's infrastructure once
// deployed, using SUPABASE_SERVICE_ROLE_KEY (available automatically as
// an Edge Function secret) to read/write across all tenants.
//
// Idempotency: reminders_log has a unique constraint on
// (invoice_id, reminder_type, sent_on), so if this function is ever
// triggered twice in one day, the second run's insert simply fails and
// that reminder is skipped rather than emailing the client twice.

import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_URL = "https://api.resend.com/emails";

interface InvoiceRow {
  id: string;
  user_id: string;
  invoice_number: string;
  total_pence: number;
  currency: string;
  due_date: string;
  public_token: string;
  client: { email: string | null; name: string } | null;
  profile: { business_name: string | null; full_name: string | null } | null;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "invoices@resend.dev";
  const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:3000";

  const today = new Date().toISOString().slice(0, 10);
  const threeDaysOut = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  const results = { upcoming: 0, overdue: 0, skipped: 0, failed: 0 };

  // --- Upcoming: due in exactly 3 days, not yet paid ----------------------
  const { data: upcoming } = await supabase
    .from("invoices")
    .select("id, user_id, invoice_number, total_pence, currency, due_date, public_token, client:clients(email,name), profile:profiles!invoices_user_id_fkey(business_name,full_name)")
    .in("status", ["sent", "viewed"])
    .eq("due_date", threeDaysOut)
    .returns<InvoiceRow[]>();

  for (const invoice of upcoming ?? []) {
    await sendOneReminder(supabase, invoice, "upcoming", resendApiKey, fromEmail, siteUrl, results);
  }

  // --- Overdue: past due date, not yet paid --------------------------------
  const { data: overdueInvoices } = await supabase
    .from("invoices")
    .select("id, user_id, invoice_number, total_pence, currency, due_date, public_token, client:clients(email,name), profile:profiles!invoices_user_id_fkey(business_name,full_name)")
    .in("status", ["sent", "viewed", "overdue"])
    .lt("due_date", today)
    .returns<InvoiceRow[]>();

  for (const invoice of overdueInvoices ?? []) {
    // Flip status to overdue as we process it (a plain sent/viewed invoice
    // past its due date is overdue by definition; this keeps the
    // dashboard's "outstanding" figures accurate without a separate cron).
    await supabase.from("invoices").update({ status: "overdue" }).eq("id", invoice.id);
    await sendOneReminder(supabase, invoice, "overdue", resendApiKey, fromEmail, siteUrl, results);
  }

  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
});

async function sendOneReminder(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  invoice: InvoiceRow,
  type: "upcoming" | "overdue",
  resendApiKey: string,
  fromEmail: string,
  siteUrl: string,
  results: { upcoming: number; overdue: number; skipped: number; failed: number }
) {
  if (!invoice.client?.email) {
    results.skipped++;
    return;
  }

  // Claim today's slot for this (invoice, type) before sending — if this
  // insert fails on the unique constraint, we've already sent today's
  // reminder (or a concurrent run got there first), so skip sending.
  const { error: logError } = await supabase
    .from("reminders_log")
    .insert({ invoice_id: invoice.id, user_id: invoice.user_id, reminder_type: type });

  if (logError) {
    results.skipped++;
    return;
  }

  const businessName = invoice.profile?.business_name || invoice.profile?.full_name || "Your freelancer";

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: invoice.client.email,
        subject:
          type === "upcoming"
            ? `Reminder: invoice ${invoice.invoice_number} is due soon`
            : `Overdue: invoice ${invoice.invoice_number} from ${businessName}`,
        html: `<p>Invoice ${invoice.invoice_number} for ${(invoice.total_pence / 100).toFixed(2)} ${invoice.currency} ${
          type === "upcoming" ? `is due on ${invoice.due_date}` : `was due on ${invoice.due_date} and is now overdue`
        }.</p><p><a href="${siteUrl}/invoice/${invoice.public_token}">View invoice</a></p>`,
      }),
    });

    if (!res.ok) throw new Error(`Resend API returned ${res.status}`);
    results[type]++;
  } catch (err) {
    console.error(`Failed to send ${type} reminder for invoice ${invoice.id}`, err);
    results.failed++;
  }
}
