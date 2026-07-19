import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InvoicesTable } from "@/components/invoices/invoices-table";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, client:clients(name, company_name)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-sm text-muted-foreground">Every invoice you've ever raised.</p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">
            <Plus className="h-4 w-4" />
            New invoice
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <InvoicesTable invoices={invoices ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
