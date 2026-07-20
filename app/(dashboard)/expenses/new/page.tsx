import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpenseForm } from "@/components/expenses/expense-form";

export const metadata: Metadata = { title: "Log expense" };

export default async function NewExpensePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, company_name")
    .eq("user_id", user!.id)
    .eq("archived", false)
    .order("name");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Log an expense</h1>
        <p className="text-sm text-muted-foreground">Keep a record for your books, and pass it on if it's billable.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Expense details</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseForm clients={clients ?? []} userId={user!.id} />
        </CardContent>
      </Card>
    </div>
  );
}
