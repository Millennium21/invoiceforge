"use client";

import * as React from "react";
import { Receipt, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUnbilledExpenses } from "@/actions/expenses";
import { getUnbilledTimeEntries } from "@/actions/time-entries";
import { formatMoney } from "@/lib/money";
import type { ExternalLineItem } from "@/components/invoices/line-items-editor";
import type { Expense, TimeEntry } from "@/types";

export function BillableItemsPicker({
  clientId,
  currency,
  onAdd,
}: {
  clientId: string;
  currency: string;
  onAdd: (items: ExternalLineItem[]) => void;
}) {
  const [loaded, setLoaded] = React.useState<{
    clientId: string;
    expenses: Expense[];
    timeEntries: TimeEntry[];
  } | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    Promise.all([getUnbilledExpenses(clientId), getUnbilledTimeEntries(clientId)]).then(([exp, time]) => {
      if (cancelled) return;
      setLoaded({ clientId, expenses: exp, timeEntries: time });
      setSelected(new Set());
    });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const loading = !!clientId && loaded?.clientId !== clientId;
  const expenses = !loading && loaded ? loaded.expenses : [];
  const timeEntries = !loading && loaded ? loaded.timeEntries : [];

  if (!clientId || loading) return null;
  if (expenses.length === 0 && timeEntries.length === 0) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAddSelected() {
    const items: ExternalLineItem[] = [];
    for (const expense of expenses) {
      if (selected.has(expense.id)) {
        items.push({
          description: expense.description,
          quantity: 1,
          unitPricePence: expense.amount_pence,
          sourceKind: "expense",
          sourceId: expense.id,
        });
      }
    }
    for (const entry of timeEntries) {
      if (selected.has(entry.id) && entry.ended_at) {
        const hours = (new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 3600000;
        items.push({
          description: entry.description || "Tracked time",
          quantity: Math.round(hours * 100) / 100,
          unitPricePence: entry.hourly_rate_pence,
          sourceKind: "timeEntry",
          sourceId: entry.id,
        });
      }
    }
    onAdd(items);
    setSelected(new Set());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Unbilled for this client</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {expenses.map((expense) => (
          <label key={expense.id} className="flex items-center gap-3 text-sm">
            <Checkbox checked={selected.has(expense.id)} onCheckedChange={() => toggle(expense.id)} />
            <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1">{expense.description}</span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {formatMoney(expense.amount_pence, currency)}
            </span>
          </label>
        ))}
        {timeEntries.map((entry) => {
          const hours = entry.ended_at
            ? (new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 3600000
            : 0;
          return (
            <label key={entry.id} className="flex items-center gap-3 text-sm">
              <Checkbox checked={selected.has(entry.id)} onCheckedChange={() => toggle(entry.id)} />
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1">{entry.description || "Tracked time"}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {hours.toFixed(2)}h @ {formatMoney(entry.hourly_rate_pence, currency)}
              </span>
            </label>
          );
        })}
        <Button type="button" variant="outline" size="sm" onClick={handleAddSelected} disabled={selected.size === 0} className="self-start">
          Add {selected.size > 0 ? selected.size : ""} to invoice
        </Button>
      </CardContent>
    </Card>
  );
}
