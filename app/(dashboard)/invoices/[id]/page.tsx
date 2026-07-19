import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { MessageThread } from "@/components/messages/message-thread";
import { markMessagesReadAction } from "@/actions/messages";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, client:clients(*)")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!invoice) notFound();

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("sort_order");

  const { data: messages } = await supabase
    .from("invoice_messages")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at");

  // Fire-and-forget: viewing the invoice is what "reading" the client's
  // messages means here. Not awaited so a slow write never delays the page.
  void markMessagesReadAction(id);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const publicUrl = `${siteUrl}/invoice/${invoice.public_token}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">{invoice.invoice_number}</h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {invoice.client?.company_name || invoice.client?.name} · Due {formatDate(invoice.due_date)}
          </p>
        </div>
        <InvoiceActions invoice={invoice} publicUrl={publicUrl} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Line items</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {(items ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2.5 text-sm">
              <span>{item.description}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {item.quantity} × {formatMoney(item.unit_price_pence, invoice.currency)}
              </span>
              <span className="font-mono tabular-nums">
                {formatMoney(Math.round(item.quantity * item.unit_price_pence), invoice.currency)}
              </span>
            </div>
          ))}
          <div className="ml-auto flex w-full max-w-[280px] flex-col gap-1 pt-3 font-mono text-sm tabular-nums">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatMoney(invoice.subtotal_pence, invoice.currency)}</span>
            </div>
            {invoice.discount_pence > 0 ? (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span>-{formatMoney(invoice.discount_pence, invoice.currency)}</span>
              </div>
            ) : null}
            {invoice.tax_pence > 0 ? (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax ({invoice.tax_rate_percent}%)</span>
                <span>{formatMoney(invoice.tax_pence, invoice.currency)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-border pt-1 text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{formatMoney(invoice.total_pence, invoice.currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {invoice.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{invoice.notes}</CardContent>
        </Card>
      ) : null}

      {invoice.status !== "draft" ? (
        <Card>
          <CardContent className="pt-6">
            <MessageThread messages={messages ?? []} viewerRole="freelancer" invoiceId={invoice.id} />
          </CardContent>
        </Card>
      ) : null}

      {invoice.status === "draft" ? (
        <p className="text-center text-sm text-muted-foreground">
          <Link href={`/invoices/${invoice.id}/edit`} className="text-primary hover:underline">
            Edit this invoice
          </Link>{" "}
          before sending it.
        </p>
      ) : null}
    </div>
  );
}
