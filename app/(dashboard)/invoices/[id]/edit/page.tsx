import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceForm } from "@/components/invoices/invoice-form";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!invoice) notFound();
  if (invoice.status !== "draft") redirect(`/invoices/${id}`);

  const [{ data: items }, { data: clients }, { data: profile }] = await Promise.all([
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order"),
    supabase.from("clients").select("id, name, company_name").eq("user_id", user!.id).eq("archived", false).order("name"),
    supabase.from("profiles").select("default_currency, default_tax_rate").eq("id", user!.id).single(),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit {invoice.invoice_number}</h1>
        <p className="text-sm text-muted-foreground">Still a draft — nothing's been sent yet.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Invoice details</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceForm
            invoice={invoice}
            items={items ?? []}
            clients={clients ?? []}
            defaultCurrency={profile?.default_currency ?? "GBP"}
            defaultTaxRate={profile?.default_tax_rate ?? 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
