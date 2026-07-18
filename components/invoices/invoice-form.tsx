"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineItemsEditor, type LineItemsEditorHandle } from "@/components/invoices/line-items-editor";
import { TemplateLoader } from "@/components/invoices/template-loader";
import { BillableItemsPicker } from "@/components/invoices/billable-items-picker";
import { createInvoiceAction, updateInvoiceAction } from "@/actions/invoices";
import type { Client, DiscountType, Invoice, InvoiceItem, RecurrenceInterval } from "@/types";

interface InvoiceFormProps {
  clients: Pick<Client, "id" | "name" | "company_name">[];
  invoice?: Invoice;
  items?: InvoiceItem[];
  defaultCurrency: string;
  defaultTaxRate: number;
}

export function InvoiceForm({ clients, invoice, items, defaultCurrency, defaultTaxRate }: InvoiceFormProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [clientId, setClientId] = React.useState(invoice?.client_id ?? clients[0]?.id ?? "");
  const [discountType, setDiscountType] = React.useState<DiscountType>(invoice?.discount_type ?? "none");
  const [discountValue, setDiscountValue] = React.useState(invoice?.discount_value ?? 0);
  const [taxRatePercent, setTaxRatePercent] = React.useState(invoice?.tax_rate_percent ?? defaultTaxRate);
  const [isRecurring, setIsRecurring] = React.useState(invoice?.is_recurring ?? false);
  const [recurrenceInterval, setRecurrenceInterval] = React.useState<RecurrenceInterval>(
    invoice?.recurrence_interval ?? "monthly"
  );
  const lineItemsRef = React.useRef<LineItemsEditorHandle>(null);

  function handleLoadTemplate(
    templateItems: { description: string; quantity: number; unitPricePence: number }[],
    templateDiscountType: DiscountType,
    templateDiscountValue: number,
    templateTaxRatePercent: number | null
  ) {
    lineItemsRef.current?.replaceAllItems(templateItems);
    setDiscountType(templateDiscountType);
    setDiscountValue(templateDiscountValue);
    if (templateTaxRatePercent !== null) setTaxRatePercent(templateTaxRatePercent);
  }

  const [today] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [defaultDueDate] = React.useState(() =>
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );

  async function handleSubmit(formData: FormData) {
    if (!clientId) {
      toast.error("Add a client first.");
      return;
    }
    setPending(true);
    const result = invoice
      ? await updateInvoiceAction(invoice.id, formData)
      : await createInvoiceAction(formData);
    setPending(false);
    if (result && !result.success) toast.error(result.error);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="currency" value={defaultCurrency} />
      <input type="hidden" name="discountType" value={discountType} />
      <input type="hidden" name="discountValue" value={discountValue} />
      <input type="hidden" name="taxRatePercent" value={taxRatePercent} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Client *</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name || c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {clients.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              You need a client first —{" "}
              <Link href="/clients/new" className="text-primary hover:underline">
                add one
              </Link>
              .
            </p>
          ) : null}
        </div>
        <div />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issueDate">Issue date</Label>
          <Input id="issueDate" name="issueDate" type="date" defaultValue={invoice?.issue_date ?? today} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dueDate">Due date</Label>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={invoice?.due_date ?? defaultDueDate}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Line items</Label>
          {!invoice ? <TemplateLoader onLoad={handleLoadTemplate} /> : null}
        </div>
        <LineItemsEditor
          ref={lineItemsRef}
          initialItems={items}
          currency={defaultCurrency}
          discountType={discountType}
          discountValue={discountValue}
          taxRatePercent={taxRatePercent}
        />
      </div>

      {clientId ? (
        <BillableItemsPicker
          clientId={clientId}
          currency={defaultCurrency}
          onAdd={(newItems) => lineItemsRef.current?.appendItems(newItems)}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label>Discount</Label>
          <div className="flex gap-2">
            <Select value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="percent">%</SelectItem>
                <SelectItem value="fixed">Fixed</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              step="0.01"
              disabled={discountType === "none"}
              value={discountValue}
              onChange={(e) => setDiscountValue(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="taxRatePercentInput">Tax rate (%)</Label>
          <Input
            id="taxRatePercentInput"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={taxRatePercent}
            onChange={(e) => setTaxRatePercent(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="rounded-md border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="isRecurring">Recurring invoice</Label>
            <p className="text-xs text-muted-foreground">
              Automatically generates and sends a new copy on schedule.
            </p>
          </div>
          <Switch id="isRecurring" name="isRecurring" checked={isRecurring} onCheckedChange={setIsRecurring} />
        </div>
        {isRecurring ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Repeats</Label>
              <Select
                value={recurrenceInterval}
                onValueChange={(v) => setRecurrenceInterval(v as RecurrenceInterval)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="recurrenceInterval" value={recurrenceInterval} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="recurrenceEndDate">Ends on (optional)</Label>
              <Input
                id="recurrenceEndDate"
                name="recurrenceEndDate"
                type="date"
                defaultValue={invoice?.recurrence_end_date ?? ""}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes for the client</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={invoice?.notes ?? ""}
          placeholder="Payment instructions, thank-you note, anything you'd like them to see."
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || clients.length === 0}>
          {pending ? "Saving…" : invoice ? "Save changes" : "Create invoice"}
        </Button>
      </div>
    </form>
  );
}
