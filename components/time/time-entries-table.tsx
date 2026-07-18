"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { deleteTimeEntryAction } from "@/actions/time-entries";
import type { TimeEntry, Client } from "@/types";

type Row = TimeEntry & { client: Pick<Client, "name" | "company_name"> | null };

function durationLabel(entry: TimeEntry): string {
  if (!entry.ended_at) return "Running";
  const seconds = (new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 1000;
  const hours = seconds / 3600;
  return `${hours.toFixed(2)}h`;
}

function amountPence(entry: TimeEntry): number {
  if (!entry.ended_at) return 0;
  const hours = (new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 3600000;
  return Math.round(hours * entry.hourly_rate_pence);
}

export function TimeEntriesTable({ entries, currency }: { entries: Row[]; currency: string }) {
  const router = useRouter();

  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No time logged yet.</p>;
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this time entry?")) return;
    const result = await deleteTimeEntryAction(id);
    if (!result.success) toast.error(result.error);
    router.refresh();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Description</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>{entry.description || "Untitled"}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {entry.client?.company_name || entry.client?.name || "—"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{formatDate(entry.started_at)}</TableCell>
            <TableCell className="font-mono text-sm tabular-nums">{durationLabel(entry)}</TableCell>
            <TableCell>
              {!entry.is_billable ? (
                <Badge variant="outline">Not billable</Badge>
              ) : entry.invoice_id ? (
                <Badge variant="secondary">Invoiced</Badge>
              ) : (
                <Badge variant="outline">Unbilled</Badge>
              )}
            </TableCell>
            <TableCell className="text-right font-mono text-sm tabular-nums">
              {entry.ended_at ? formatMoney(amountPence(entry), currency) : "—"}
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
