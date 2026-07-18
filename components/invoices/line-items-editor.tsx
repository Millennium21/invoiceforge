"use client";

import * as React from "react";
import { Plus, Trash2, Receipt, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeInvoiceTotals, formatMoney, parseMoneyToPence, type DiscountType } from "@/lib/money";
import type { InvoiceItem } from "@/types";

interface Row {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string; // major units as typed, e.g. "150.00" — converted to pence on submit/preview
  sourceKind?: "expense" | "timeEntry";
  sourceId?: string;
}

export interface ExternalLineItem {
  description: string;
  quantity: number;
  unitPricePence: number;
  sourceKind?: "expense" | "timeEntry";
  sourceId?: string;
}

export interface LineItemsEditorHandle {
  /** Adds rows on top of whatever's already there — used by the billable
   * expenses/time-entries pickers, which are additive by nature. */
  appendItems: (items: ExternalLineItem[]) => void;
  /** Replaces every row — used by "load from template," which represents
   * starting over from a known-good set of items. */
  replaceAllItems: (items: ExternalLineItem[]) => void;
}

function toRow(item?: InvoiceItem): Row {
  return {
    key: item?.id ?? crypto.randomUUID(),
    description: item?.description ?? "",
    quantity: item ? String(item.quantity) : "1",
    unitPrice: item ? (item.unit_price_pence / 100).toFixed(2) : "",
  };
}

function toRowFromExternal(item: ExternalLineItem): Row {
  return {
    key: crypto.randomUUID(),
    description: item.description,
    quantity: String(item.quantity),
    unitPrice: (item.unitPricePence / 100).toFixed(2),
    sourceKind: item.sourceKind,
    sourceId: item.sourceId,
  };
}

export const LineItemsEditor = React.forwardRef<
  LineItemsEditorHandle,
  {
    initialItems?: InvoiceItem[];
    currency: string;
    discountType: DiscountType;
    discountValue: number;
    taxRatePercent: number;
  }
>(function LineItemsEditor({ initialItems, currency, discountType, discountValue, taxRatePercent }, ref) {
  const [rows, setRows] = React.useState<Row[]>(() =>
    initialItems && initialItems.length > 0 ? initialItems.map(toRow) : [toRow()]
  );

  React.useImperativeHandle(ref, () => ({
    appendItems: (items) => setRows((prev) => [...prev, ...items.map(toRowFromExternal)]),
    replaceAllItems: (items) => setRows(items.length > 0 ? items.map(toRowFromExternal) : [toRow()]),
  }));

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, toRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  const totals = computeInvoiceTotals(
    rows.map((r) => ({ quantity: parseFloat(r.quantity) || 0, unitPricePence: parseMoneyToPence(r.unitPrice) })),
    { discountType, discountValue, taxRatePercent }
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden grid-cols-[1fr_100px_140px_40px] gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
        <span>Description</span>
        <span>Qty</span>
        <span>Unit price</span>
        <span />
      </div>

      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_100px_140px_40px]">
          <div className="relative">
            <Input
              name="itemDescription"
              required
              placeholder="Design sprint"
              value={row.description}
              onChange={(e) => updateRow(row.key, { description: e.target.value })}
              className={row.sourceKind ? "pl-8" : undefined}
            />
            {row.sourceKind ? (
              <span
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                title={row.sourceKind === "expense" ? "From a billable expense" : "From tracked time"}
              >
                {row.sourceKind === "expense" ? (
                  <Receipt className="h-3.5 w-3.5" />
                ) : (
                  <Clock className="h-3.5 w-3.5" />
                )}
              </span>
            ) : null}
            {row.sourceKind === "expense" && row.sourceId ? (
              <input type="hidden" name="linkedExpenseIds" value={row.sourceId} />
            ) : null}
            {row.sourceKind === "timeEntry" && row.sourceId ? (
              <input type="hidden" name="linkedTimeEntryIds" value={row.sourceId} />
            ) : null}
          </div>
          <Input
            name="itemQuantity"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={row.quantity}
            onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
          />
          <Input
            name="itemUnitPricePence"
            type="hidden"
            value={parseMoneyToPence(row.unitPrice)}
            readOnly
          />
          <Input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={row.unitPrice}
            onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeRow(row.key)}
            disabled={rows.length === 1}
            aria-label="Remove line"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addRow} className="self-start">
        <Plus className="h-4 w-4" />
        Add line
      </Button>

      <div className="ml-auto flex w-full max-w-[280px] flex-col gap-1 border-t border-border pt-3 font-mono text-sm tabular-nums">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatMoney(totals.subtotalPence, currency)}</span>
        </div>
        {totals.discountPence > 0 ? (
          <div className="flex justify-between text-muted-foreground">
            <span>Discount</span>
            <span>-{formatMoney(totals.discountPence, currency)}</span>
          </div>
        ) : null}
        {totals.taxPence > 0 ? (
          <div className="flex justify-between text-muted-foreground">
            <span>Tax</span>
            <span>{formatMoney(totals.taxPence, currency)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-border pt-1 text-base font-semibold text-foreground">
          <span>Total</span>
          <span>{formatMoney(totals.totalPence, currency)}</span>
        </div>
      </div>
    </div>
  );
});
