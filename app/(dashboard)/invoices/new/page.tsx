import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceForm } from "@/components/invoices/invoice-form";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: clients }, { data: profile }] = await Promise.all([
    supabase.from("clients").select("id, name, company_name").eq("user_id", user!.id).eq("archived", false).order("name"),
    supabase.from("profiles").select("default_currency, default_tax_rate").eq("id", user!.id).single(),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">New invoice</h1>
        <p className="text-sm text-muted-foreground">It's saved as a draft until you send it.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Invoice details</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceForm
            clients={clients ?? []}
            defaultCurrency={profile?.default_currency ?? "GBP"}
            defaultTaxRate={profile?.default_tax_rate ?? 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
