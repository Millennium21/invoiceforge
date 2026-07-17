"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { expenseSchema } from "@/lib/validations/expense";
import type { ActionResult } from "@/actions/clients";

export async function createExpenseAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const parsed = expenseSchema.safeParse({
    clientId: formData.get("clientId"),
    description: formData.get("description"),
    category: formData.get("category") || "other",
    amountPence: formData.get("amountPence"),
    expenseDate: formData.get("expenseDate"),
    isBillable: formData.get("isBillable") === "on",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const receiptUrl = formData.get("receiptUrl");

  const { error } = await supabase.from("expenses").insert({
    user_id: user.id,
    client_id: parsed.data.clientId || null,
    description: parsed.data.description,
    category: parsed.data.category,
    amount_pence: parsed.data.amountPence,
    expense_date: parsed.data.expenseDate,
    is_billable: parsed.data.isBillable,
    receipt_url: typeof receiptUrl === "string" && receiptUrl ? receiptUrl : null,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function deleteExpenseAction(expenseId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { error } = await supabase.from("expenses").delete().eq("id", expenseId).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/expenses");
  return { success: true };
}

/**
 * Fetches unbilled billable expenses for a client — powers the picker in
 * the invoice form. Not a page, just data for a client component to
 * render, so it's a plain async function rather than a Server Action
 * (no "use server" mutation semantics needed).
 */
export async function getUnbilledExpenses(clientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user.id)
    .eq("client_id", clientId)
    .eq("is_billable", true)
    .is("invoice_id", null)
    .order("expense_date", { ascending: false });

  return data ?? [];
}
