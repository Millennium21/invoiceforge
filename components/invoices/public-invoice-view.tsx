"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { createInvoiceCheckoutAction } from "@/actions/public-checkout";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { MessageThread } from "@/components/messages/message-thread";
import type { Client, Invoice, InvoiceItem, InvoiceMessage, Profile } from "@/types";

function PayButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Redirecting to secure checkout…" : "Pay now"}
    </Button>
  );
}

export function PublicInvoiceView({
  invoice,
  client,
  profile,
  items,
  messages,
  token,
}: {
  invoice: Invoice;
  client: Client;
  profile: Profile;
  items: InvoiceItem[];
  messages: InvoiceMessage[];
  token: string;
}) {
  async function handlePay() {
    const result = await createInvoiceCheckoutAction(token);
    if (result && !result.success) toast.error(result.error);
  }

  const payable = invoice.status !== "paid" && invoice.status !== "cancelled";

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-10 sm:py-16">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {profile.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logo_url} alt="" className="h-10 w-10 rounded object-contain" />
          ) : null}
          <span className="font-serif text-lg font-semibold">{profile.business_name || profile.full_name}</span>
        </div>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoice</p>
            <p className="font-mono text-xl font-semibold">{invoice.invoice_number}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount due</p>
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {formatMoney(invoice.total_pence, invoice.currency)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-6 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Billed to</p>
            <p className="mt-1">{client.company_name || client.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Due date</p>
            <p className="mt-1">{formatDate(invoice.due_date)}</p>
          </div>
        </div>

        <div className="flex flex-col divide-y divide-border border-t border-border">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-3 text-sm">
              <span>{item.description}</span>
              <span className="font-mono tabular-nums">
                {formatMoney(Math.round(item.quantity * item.unit_price_pence), invoice.currency)}
              </span>
            </div>
          ))}
        </div>

        <div className="ml-auto flex w-full max-w-[240px] flex-col gap-1 pt-4 font-mono text-sm tabular-nums">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatMoney(invoice.subtotal_pence, invoice.currency)}</span>
          </div>
          {invoice.tax_pence > 0 ? (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span>{formatMoney(invoice.tax_pence, invoice.currency)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-border pt-1 text-base font-semibold text-foreground">
            <span>Total</span>
            <span>{formatMoney(invoice.total_pence, invoice.currency)}</span>
          </div>
        </div>

        {invoice.notes ? <p className="mt-6 text-sm text-muted-foreground">{invoice.notes}</p> : null}
      </div>

      <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
        <a
          href={`/api/invoices/${invoice.id}/pdf?token=${token}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </a>
        {payable ? (
          <form action={handlePay}>
            <PayButton />
          </form>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <MessageThread messages={messages} viewerRole="client" token={token} />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        This invoice is not legal or tax advice. Payments are processed securely by Stripe.
      </p>
    </div>
  );
}
