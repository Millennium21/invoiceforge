import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * UK GDPR right to data portability. Everything here is scoped by the
 * ordinary session-based client (not the admin client) specifically so
 * RLS does the "only this user's rows" filtering the same way it does
 * everywhere else in the app — one less place to get the scoping wrong.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [profile, clients, invoices, items, payments, subscription] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("clients").select("*").eq("user_id", user.id),
    supabase.from("invoices").select("*").eq("user_id", user.id),
    supabase.from("invoice_items").select("*").eq("user_id", user.id),
    supabase.from("payments").select("*").eq("user_id", user.id),
    supabase.from("subscriptions").select("*").eq("user_id", user.id).single(),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profile.data,
    clients: clients.data,
    invoices: invoices.data,
    invoice_items: items.data,
    payments: payments.data,
    subscription: subscription.data,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="invoiceforge-data-export-${user.id}.json"`,
    },
  });
}
