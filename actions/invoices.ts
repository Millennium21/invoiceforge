"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { invoiceSchema } from "@/lib/validations/invoice";
import { computeInvoiceTotals } from "@/lib/money";
import { canCreateInvoice } from "@/lib/payments";
import { captureServerEvent } from "@/lib/analytics";
import { sendInvoiceEmail } from "@/lib/resend";
import type { ActionResult } from "@/actions/clients";
import type { Invoice, Profile } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function parseInvoiceForm(formData: FormData) {
  const itemDescriptions = formData.getAll("itemDescription");
  const itemQuantities = formData.getAll("itemQuantity");
  const itemPrices = formData.getAll("itemUnitPricePence");

  const items = itemDescriptions.map((description, i) => ({
    description: String(description),
    quantity: Number(itemQuantities[i]),
    unitPricePence: Number(itemPrices[i]),
  }));

  return invoiceSchema.safeParse({
    clientId: formData.get("clientId"),
    currency: formData.get("currency") || "GBP",
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate"),
    discountType: formData.get("discountType") || "none",
    discountValue: formData.get("discountValue") || 0,
    taxRatePercent: formData.get("taxRatePercent") || 0,
    notes: formData.get("notes"),
    items,
    isRecurring: formData.get("isRecurring") === "on",
    recurrenceInterval: formData.get("recurrenceInterval") || undefined,
    recurrenceEndDate: formData.get("recurrenceEndDate"),
  });
}

/**
 * Marks the expenses/time entries the invoice form's billable-items picker
 * added as line items as now-invoiced, via the hidden `linkedExpenseIds`
 * / `linkedTimeEntryIds` inputs LineItemsEditor renders for any row
 * tagged with a source. `.eq("user_id", user.id)` is what stops a
 * tampered id list from linking someone else's records — RLS backs that
 * up too, but the explicit filter keeps the query correct on its own.
 */
async function linkBillableItems(
  supabase: SupabaseClient,
  invoiceId: string,
  userId: string,
  formData: FormData
) {
  const expenseIds = formData.getAll("linkedExpenseIds").map(String).filter(Boolean);
  const timeEntryIds = formData.getAll("linkedTimeEntryIds").map(String).filter(Boolean);

  if (expenseIds.length > 0) {
    await supabase.from("expenses").update({ invoice_id: invoiceId }).in("id", expenseIds).eq("user_id", userId);
  }
  if (timeEntryIds.length > 0) {
    await supabase.from("time_entries").update({ invoice_id: invoiceId }).in("id", timeEntryIds).eq("user_id", userId);
  }
}

export async function createInvoiceAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const parsed = parseInvoiceForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const limitCheck = await canCreateInvoice(supabase, user.id);
  if (!limitCheck.allowed) {
    return { success: false, error: limitCheck.reason ?? "Invoice limit reached." };
  }

  // Authoritative recompute — never trust totals the client may have sent.
  const totals = computeInvoiceTotals(
    data.items.map((i) => ({ quantity: i.quantity, unitPricePence: i.unitPricePence })),
    { discountType: data.discountType, discountValue: data.discountValue, taxRatePercent: data.taxRatePercent }
  );

  const { data: invoiceData, error } = await supabase
    .rpc("create_invoice_with_items", {
      p_user_id: user.id,
      p_client_id: data.clientId,
      p_currency: data.currency,
      p_issue_date: data.issueDate,
      p_due_date: data.dueDate,
      p_discount_type: data.discountType,
      p_discount_value: data.discountValue,
      p_tax_rate_percent: data.taxRatePercent,
      p_notes: data.notes || null,
      p_is_recurring: data.isRecurring,
      p_recurrence_interval: data.recurrenceInterval || null,
      p_recurrence_end_date: data.recurrenceEndDate || null,
      p_subtotal_pence: totals.subtotalPence,
      p_discount_pence: totals.discountPence,
      p_tax_pence: totals.taxPence,
      p_total_pence: totals.totalPence,
      p_items: data.items,
    })
    .single();

  // Cast rather than infer: without a live Supabase project there's no
  // `supabase gen types typescript` output, so RPC calls fall back to an
  // untyped `{}` return. The RPC's actual shape is guaranteed by
  // `returns public.invoices` in 0007_invoice_write_rpc.sql.
  const invoice = invoiceData as unknown as Invoice | null;

  if (error || !invoice) return { success: false, error: error?.message ?? "Could not create invoice." };

  await linkBillableItems(supabase, invoice.id, user.id, formData);

  captureServerEvent(user.id, "invoice_created", { invoice_id: invoice.id, total_pence: totals.totalPence });

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  redirect(`/invoices/${invoice.id}`);
}

export async function updateInvoiceAction(invoiceId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const parsed = parseInvoiceForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  // Only draft invoices can be edited — once sent, the numbers a client
  // was shown must not silently change underneath them.
  const { data: existing } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single();

  if (!existing) return { success: false, error: "Invoice not found." };
  if (existing.status !== "draft") {
    return { success: false, error: "Only draft invoices can be edited. Duplicate it instead." };
  }

  const totals = computeInvoiceTotals(
    data.items.map((i) => ({ quantity: i.quantity, unitPricePence: i.unitPricePence })),
    { discountType: data.discountType, discountValue: data.discountValue, taxRatePercent: data.taxRatePercent }
  );

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      client_id: data.clientId,
      currency: data.currency,
      issue_date: data.issueDate,
      due_date: data.dueDate,
      discount_type: data.discountType,
      discount_value: data.discountValue,
      tax_rate_percent: data.taxRatePercent,
      notes: data.notes || null,
      is_recurring: data.isRecurring,
      recurrence_interval: data.recurrenceInterval || null,
      recurrence_end_date: data.recurrenceEndDate || null,
      subtotal_pence: totals.subtotalPence,
      discount_pence: totals.discountPence,
      tax_pence: totals.taxPence,
      total_pence: totals.totalPence,
    })
    .eq("id", invoiceId)
    .eq("user_id", user.id);

  if (updateError) return { success: false, error: updateError.message };

  // Replace line items wholesale rather than diffing — simpler and,
  // because this is a full-page form submit with no concurrent editors,
  // there's no risk it clobbers someone else's in-flight edit.
  await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
  const { error: itemsError } = await supabase.from("invoice_items").insert(
    data.items.map((item, i) => ({
      invoice_id: invoiceId,
      user_id: user.id,
      description: item.description,
      quantity: item.quantity,
      unit_price_pence: item.unitPricePence,
      sort_order: i,
    }))
  );

  if (itemsError) return { success: false, error: itemsError.message };

  await linkBillableItems(supabase, invoiceId, user.id, formData);

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}

export async function deleteInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  // RLS's invoices_delete_own policy additionally requires status='draft'
  // (see 0003_invoices.sql) — a sent/paid invoice is a financial record
  // and this DELETE will simply affect 0 rows rather than remove it.
  const { error, count } = await supabase
    .from("invoices")
    .delete({ count: "exact" })
    .eq("id", invoiceId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  if (count === 0) return { success: false, error: "Only draft invoices can be deleted." };

  revalidatePath("/invoices");
  return { success: true };
}

export async function markInvoiceSentAction(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("*, client:clients(*)")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !invoice) return { success: false, error: "Invoice not found." };
  if (!invoice.client?.email) {
    return { success: false, error: "This client has no email address on file." };
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("user_id", user.id);

  if (updateError) return { success: false, error: updateError.message };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    await sendInvoiceEmail({
      to: invoice.client.email,
      businessName: profile?.business_name || profile?.full_name || "Your freelancer",
      invoiceNumber: invoice.invoice_number,
      amountFormatted: (invoice.total_pence / 100).toFixed(2),
      dueDateFormatted: invoice.due_date,
      publicUrl: `${siteUrl}/invoice/${invoice.public_token}`,
      kind: "sent",
    });
  } catch (err) {
    // The invoice is already marked sent — email delivery failing
    // shouldn't roll that back, but the freelancer needs to know so they
    // can resend or contact the client another way.
    console.error("Failed to send invoice email", err);
    return { success: false, error: "Invoice marked as sent, but the email failed to send." };
  }

  captureServerEvent(user.id, "invoice_sent", { invoice_id: invoiceId });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { success: true };
}

export async function duplicateInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: source, error: fetchError } = await supabase
    .from("invoices")
    .select("*, items:invoice_items(*)")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !source) return { success: false, error: "Invoice not found." };

  const { data: newInvoiceData, error } = await supabase
    .rpc("create_invoice_with_items", {
      p_user_id: user.id,
      p_client_id: source.client_id,
      p_currency: source.currency,
      p_issue_date: new Date().toISOString().slice(0, 10),
      p_due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      p_discount_type: source.discount_type,
      p_discount_value: source.discount_value,
      p_tax_rate_percent: source.tax_rate_percent,
      p_notes: source.notes,
      p_is_recurring: false,
      p_recurrence_interval: null,
      p_recurrence_end_date: null,
      p_subtotal_pence: source.subtotal_pence,
      p_discount_pence: source.discount_pence,
      p_tax_pence: source.tax_pence,
      p_total_pence: source.total_pence,
      p_items: source.items.map((i: { description: string; quantity: number; unit_price_pence: number }) => ({
        description: i.description,
        quantity: i.quantity,
        unitPricePence: i.unit_price_pence,
      })),
    })
    .single();

  const newInvoice = newInvoiceData as unknown as Invoice | null;

  if (error || !newInvoice) return { success: false, error: error?.message ?? "Could not duplicate invoice." };

  revalidatePath("/invoices");
  redirect(`/invoices/${newInvoice.id}`);
}
