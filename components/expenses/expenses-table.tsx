"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Receipt } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { deleteExpenseAction } from "@/actions/expenses";
import type { Expense, Client } from "@/types";

type Row = Expense & { client: Pick<Client, "name" | "company_name"> | null };

const CATEGORY_LABELS: Record<string, string> = {
  travel: "Travel",
  software: "Software",
  materials: "Materials",
  subcontractor: "Subcontractor",
  other: "Other",
};

export function ExpensesTable({ expenses }: { expenses: Row[] }) {
  const router = useRouter();

  if (expenses.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No expenses logged yet.</p>;
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return;
    const result = await deleteExpenseAction(id);
    if (!result.success) toast.error(result.error);
    router.refresh();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Description</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((expense) => (
          <TableRow key={expense.id}>
            <TableCell className="flex items-center gap-2">
              {expense.receipt_url ? <Receipt className="h-3.5 w-3.5 text-muted-foreground" /> : null}
              {expense.description}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{CATEGORY_LABELS[expense.category]}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {expense.client?.company_name || expense.client?.name || "—"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{formatDate(expense.expense_date)}</TableCell>
            <TableCell>
              {!expense.is_billable ? (
                <Badge variant="outline">Not billable</Badge>
              ) : expense.invoice_id ? (
                <Badge variant="secondary">Invoiced</Badge>
              ) : (
                <Badge variant="outline">Unbilled</Badge>
              )}
            </TableCell>
            <TableCell className="text-right font-mono text-sm tabular-nums">
              {formatMoney(expense.amount_pence, expense.currency)}
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(expense.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
