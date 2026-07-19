"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineItemsEditor } from "@/components/invoices/line-items-editor";
import { createTemplateAction } from "@/actions/templates";
import type { DiscountType } from "@/types";

export function TemplateForm({ defaultCurrency }: { defaultCurrency: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [discountType, setDiscountType] = React.useState<DiscountType>("none");
  const [discountValue, setDiscountValue] = React.useState(0);
  const [taxRatePercent, setTaxRatePercent] = React.useState(0);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    const result = await createTemplateAction(formData);
    setPending(false);
    if (result && !result.success) toast.error(result.error);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="discountType" value={discountType} />
      <input type="hidden" name="discountValue" value={discountValue} />
      <input type="hidden" name="taxRatePercent" value={taxRatePercent} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Template name *</Label>
        <Input id="name" name="name" required placeholder="Logo design package" />
      </div>

      <div>
        <Label className="mb-2 block">Line items</Label>
        <LineItemsEditor
          currency={defaultCurrency}
          discountType={discountType}
          discountValue={discountValue}
          taxRatePercent={taxRatePercent}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <Label htmlFor="taxRatePercentInput">Tax rate (%, optional)</Label>
          <Input
            id="taxRatePercentInput"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={taxRatePercent}
            onChange={(e) => setTaxRatePercent(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">Leave at 0 to use your account default when loaded.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Default notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save template"}
        </Button>
      </div>
    </form>
  );
}
