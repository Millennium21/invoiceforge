import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  let query = supabase
    .from("payments")
    .select("paid_at, amount_pence, currency, invoice:invoices(invoice_number, tax_pence, subtotal_pence, client:clients(name, company_name))")
    .eq("user_id", user.id)
    .order("paid_at", { ascending: true });

  if (start) query = query.gte("paid_at", start);
  if (end) query = query.lte("paid_at", end);

  const { data: payments, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (payments ?? []).map((p) => {
    const invoice = Array.isArray(p.invoice) ? p.invoice[0] : p.invoice;
    const client = invoice?.client ? (Array.isArray(invoice.client) ? invoice.client[0] : invoice.client) : null;
    return {
      "Payment date": new Date(p.paid_at).toISOString().slice(0, 10),
      "Invoice number": invoice?.invoice_number ?? "",
      Client: client?.company_name || client?.name || "",
      "Net (excl. tax)": ((invoice?.subtotal_pence ?? 0) / 100).toFixed(2),
      Tax: ((invoice?.tax_pence ?? 0) / 100).toFixed(2),
      "Gross received": (p.amount_pence / 100).toFixed(2),
      Currency: p.currency,
    };
  });

  const totalGross = (payments ?? []).reduce((sum, p) => sum + p.amount_pence, 0);
  rows.push({
    "Payment date": "",
    "Invoice number": "",
    Client: "TOTAL",
    "Net (excl. tax)": "",
    Tax: "",
    "Gross received": (totalGross / 100).toFixed(2),
    Currency: "",
  });

  const csv = toCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoiceforge-revenue-report.csv"`,
    },
  });
}
