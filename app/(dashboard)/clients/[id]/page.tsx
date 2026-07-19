import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientForm } from "@/components/clients/client-form";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!client) notFound();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total_pence, currency, due_date")
    .eq("client_id", id)
    .order("issue_date", { ascending: false })
    .limit(10);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{client.name}</h1>
        <p className="text-sm text-muted-foreground">{client.company_name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Client details</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientForm client={client} />
        </CardContent>
      </Card>

      {invoices && invoices.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Invoice history</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/invoices/${invoice.id}`}
                className="flex items-center justify-between py-3 text-sm hover:text-primary"
              >
                <span className="font-mono">{invoice.invoice_number}</span>
                <span className="text-muted-foreground">{formatDate(invoice.due_date)}</span>
                <InvoiceStatusBadge status={invoice.status} />
                <span className="font-mono tabular-nums">{formatMoney(invoice.total_pence, invoice.currency)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
