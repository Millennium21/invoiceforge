"use client";

import * as React from "react";
import Link from "next/link";
import { FileStack } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTemplatesWithItems } from "@/actions/templates";
import type { ExternalLineItem } from "@/components/invoices/line-items-editor";
import type { DiscountType, InvoiceTemplate, InvoiceTemplateItem } from "@/types";

type TemplateWithItems = InvoiceTemplate & { items: InvoiceTemplateItem[] };

export function TemplateLoader({
  onLoad,
}: {
  onLoad: (items: ExternalLineItem[], discountType: DiscountType, discountValue: number, taxRatePercent: number | null) => void;
}) {
  const [templates, setTemplates] = React.useState<TemplateWithItems[]>([]);

  React.useEffect(() => {
    getTemplatesWithItems().then(setTemplates);
  }, []);

  if (templates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No templates yet —{" "}
        <Link href="/settings/templates/new" className="text-primary hover:underline">
          create one
        </Link>{" "}
        to speed up invoices you send often.
      </p>
    );
  }

  function handleSelect(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    onLoad(
      template.items
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({ description: i.description, quantity: i.quantity, unitPricePence: i.unit_price_pence })),
      template.discount_type,
      template.discount_value,
      template.tax_rate_percent
    );
  }

  return (
    <div className="flex items-center gap-2">
      <FileStack className="h-4 w-4 text-muted-foreground" />
      <Select onValueChange={handleSelect}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Load from template…" />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
