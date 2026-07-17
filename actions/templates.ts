"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { templateSchema } from "@/lib/validations/template";
import type { ActionResult } from "@/actions/clients";
import type { InvoiceTemplate } from "@/types";

function parseTemplateForm(formData: FormData) {
  const itemDescriptions = formData.getAll("itemDescription");
  const itemQuantities = formData.getAll("itemQuantity");
  const itemPrices = formData.getAll("itemUnitPricePence");

  const items = itemDescriptions.map((description, i) => ({
    description: String(description),
    quantity: Number(itemQuantities[i]),
    unitPricePence: Number(itemPrices[i]),
  }));

  return templateSchema.safeParse({
    name: formData.get("name"),
    notes: formData.get("notes"),
    discountType: formData.get("discountType") || "none",
    discountValue: formData.get("discountValue") || 0,
    taxRatePercent: formData.get("taxRatePercent") || undefined,
    items,
  });
}

export async function createTemplateAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const parsed = parseTemplateForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const { data: template, error } = await supabase
    .rpc("create_template_with_items", {
      p_user_id: user.id,
      p_name: data.name,
      p_notes: data.notes || null,
      p_discount_type: data.discountType,
      p_discount_value: data.discountValue,
      p_tax_rate_percent: data.taxRatePercent ?? null,
      p_items: data.items,
    })
    .single();

  // Untyped RPC result — see the same note in actions/invoices.ts.
  const created = template as unknown as InvoiceTemplate | null;

  if (error || !created) return { success: false, error: error?.message ?? "Could not create template." };

  revalidatePath("/settings/templates");
  redirect("/settings/templates");
}

export async function deleteTemplateAction(templateId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { error } = await supabase.from("invoice_templates").delete().eq("id", templateId).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/settings/templates");
  return { success: true };
}

/**
 * Snapshots an invoice's current line items into a brand-new template —
 * the reciprocal of "load from template." Cheap to offer since the shape
 * already matches almost exactly.
 */
export async function saveInvoiceAsTemplateAction(invoiceId: string, name: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, items:invoice_items(*)")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single();

  if (!invoice) return { success: false, error: "Invoice not found." };

  const { error } = await supabase.rpc("create_template_with_items", {
    p_user_id: user.id,
    p_name: name,
    p_notes: invoice.notes,
    p_discount_type: invoice.discount_type,
    p_discount_value: invoice.discount_value,
    p_tax_rate_percent: invoice.tax_rate_percent,
    p_items: invoice.items.map((i: { description: string; quantity: number; unit_price_pence: number }) => ({
      description: i.description,
      quantity: i.quantity,
      unitPricePence: i.unit_price_pence,
    })),
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings/templates");
  return { success: true };
}

export async function getTemplatesWithItems() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("invoice_templates")
    .select("*, items:invoice_template_items(*)")
    .eq("user_id", user.id)
    .order("name");

  return data ?? [];
}
