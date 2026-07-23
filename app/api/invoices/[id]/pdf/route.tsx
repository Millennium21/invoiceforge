import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvoiceDocument } from "@/lib/pdf/InvoiceDocument";

// @react-pdf/renderer runs actual PDF layout/rendering code, which needs
// the Node runtime — it will not work on the Edge runtime.
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  // Two legitimate ways to reach this route: the signed-in owner viewing
  // their own dashboard, or a client following their public invoice link
  // (?token=...). Both end up fetching through the admin client so the
  // query shape is identical either way — only the WHERE clause differs,
  // and it's always scoped to something the caller has actually proven
  // they're allowed to see.
  const admin = createAdminClient();
  let invoiceQuery = admin.from("invoices").select("*, client:clients(*), profile:profiles!invoices_user_id_fkey(*)");

  if (token) {
    invoiceQuery = invoiceQuery.eq("id", id).eq("public_token", token);
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    invoiceQuery = invoiceQuery.eq("id", id).eq("user_id", user.id);
  }

  const { data: invoice, error } = await invoiceQuery.single();
  if (error || !invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

  const { data: items } = await admin
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("sort_order");

  const pdfBuffer = await renderToBuffer(
    <InvoiceDocument
      profile={invoice.profile}
      client={invoice.client}
      items={items ?? []}
      invoiceNumber={invoice.invoice_number}
      issueDate={invoice.issue_date}
      dueDate={invoice.due_date}
      currency={invoice.currency}
      subtotalPence={invoice.subtotal_pence}
      discountPence={invoice.discount_pence}
      taxPence={invoice.tax_pence}
      taxRatePercent={invoice.tax_rate_percent}
      totalPence={invoice.total_pence}
      notes={invoice.notes}
    />
  );

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.invoice_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
