import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpensesTable } from "@/components/expenses/expenses-table";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: expenses }, { data: profile }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*, client:clients(name, company_name)")
      .eq("user_id", user!.id)
      .order("expense_date", { ascending: false }),
    supabase.from("profiles").select("default_currency").eq("id", user!.id).single(),
  ]);

  const currency = profile?.default_currency || "GBP";
  const totalPence = (expenses ?? []).reduce((sum, e) => sum + e.amount_pence, 0);
  const unbilledPence = (expenses ?? [])
    .filter((e) => e.is_billable && !e.invoice_id)
    .reduce((sum, e) => sum + e.amount_pence, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <p className="text-sm text-muted-foreground">Track costs and pass billable ones on to clients.</p>
        </div>
        <Button asChild>
          <Link href="/expenses/new">
            <Plus className="h-4 w-4" />
            Log expense
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total logged
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl font-semibold tabular-nums">
            {formatMoney(totalPence, currency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Unbilled, billable to clients
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl font-semibold tabular-nums text-stamp-amber">
            {formatMoney(unbilledPence, currency)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ExpensesTable expenses={expenses ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
