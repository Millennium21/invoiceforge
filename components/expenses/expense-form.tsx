"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { createExpenseAction } from "@/actions/expenses";
import { parseMoneyToPence } from "@/lib/money";
import type { Client, ExpenseCategory } from "@/types";

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "travel", label: "Travel" },
  { value: "software", label: "Software" },
  { value: "materials", label: "Materials" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "other", label: "Other" },
];

export function ExpenseForm({ clients, userId }: { clients: Pick<Client, "id" | "name" | "company_name">[]; userId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [receiptUrl, setReceiptUrl] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<ExpenseCategory>("other");
  const [isBillable, setIsBillable] = React.useState(false);
  const [clientId, setClientId] = React.useState<string>("");
  const [amountDisplay, setAmountDisplay] = React.useState("");
  const [today] = React.useState(() => new Date().toISOString().slice(0, 10));

  async function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Receipt must be under 5MB.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    // Private bucket — the {user_id}/... prefix is what the
    // receipts_owner_* RLS policies check (0009_expenses.sql).
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from("receipts").upload(path, file);
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Private bucket, so we store the storage path rather than a public
    // URL — a signed URL gets generated on demand when actually viewing it.
    setReceiptUrl(path);
    toast.success("Receipt attached");
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    const result = await createExpenseAction(formData);
    setPending(false);
    if (result && !result.success) toast.error(result.error);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="receiptUrl" value={receiptUrl ?? ""} />
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="amountPence" value={parseMoneyToPence(amountDisplay)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Description *</Label>
          <Input id="description" name="description" required placeholder="Train to client meeting" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amountDisplay">Amount (£) *</Label>
          <Input
            id="amountDisplay"
            type="number"
            min="0"
            step="0.01"
            required
            value={amountDisplay}
            onChange={(e) => setAmountDisplay(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expenseDate">Date</Label>
          <Input id="expenseDate" name="expenseDate" type="date" defaultValue={today} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Client (optional)</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder="No specific client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name || c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border p-4">
        <div>
          <Label htmlFor="isBillable">Billable to client</Label>
          <p className="text-xs text-muted-foreground">Lets you add this as a line item on their next invoice.</p>
        </div>
        <Switch id="isBillable" name="isBillable" checked={isBillable} onCheckedChange={setIsBillable} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="receipt" className="cursor-pointer text-sm font-medium text-primary hover:underline">
          {uploading ? "Uploading…" : receiptUrl ? "Receipt attached ✓ — replace" : "Attach a receipt (optional)"}
        </Label>
        <input
          id="receipt"
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="hidden"
          onChange={handleReceiptChange}
          disabled={uploading}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || uploading}>
          {pending ? "Saving…" : "Log expense"}
        </Button>
      </div>
    </form>
  );
}
