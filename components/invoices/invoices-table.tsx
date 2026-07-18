import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import type { Invoice, Client } from "@/types";

type Row = Invoice & { client: Pick<Client, "name" | "company_name"> | null };

export function InvoicesTable({ invoices }: { invoices: Row[] }) {
  if (invoices.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No invoices yet.{" "}
        <Link href="/invoices/new" className="text-primary hover:underline">
          Create your first one
        </Link>
        .
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Issued</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell>
              <Link href={`/invoices/${invoice.id}`} className="font-mono text-sm hover:text-primary">
                {invoice.invoice_number}
              </Link>
              {invoice.is_recurring ? (
                <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  Recurring
                </span>
              ) : null}
            </TableCell>
            <TableCell className="text-sm">{invoice.client?.company_name || invoice.client?.name}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{formatDate(invoice.issue_date)}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{formatDate(invoice.due_date)}</TableCell>
            <TableCell>
              <InvoiceStatusBadge status={invoice.status} />
            </TableCell>
            <TableCell className="text-right font-mono text-sm tabular-nums">
              {formatMoney(invoice.total_pence, invoice.currency)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
