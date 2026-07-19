"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { deleteTemplateAction } from "@/actions/templates";
import type { InvoiceTemplate, InvoiceTemplateItem } from "@/types";

type Row = InvoiceTemplate & { items: InvoiceTemplateItem[] };

export function TemplatesTable({ templates, currency }: { templates: Row[]; currency: string }) {
  const router = useRouter();

  if (templates.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No templates yet. Save one from the invoice editor, or create one here.
      </p>
    );
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    const result = await deleteTemplateAction(id);
    if (!result.success) toast.error(result.error);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {templates.map((template) => {
        const total = template.items.reduce((sum, i) => sum + Math.round(i.quantity * i.unit_price_pence), 0);
        return (
          <Card key={template.id}>
            <CardContent className="flex items-center justify-between gap-4 pt-6">
              <div className="flex items-center gap-3">
                <FileStack className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{template.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {template.items.length} line item{template.items.length === 1 ? "" : "s"} ·{" "}
                    {formatMoney(total, currency)}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
