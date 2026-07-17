"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clientSchema } from "@/lib/validations/client";

export type ActionResult = { success: true } | { success: false; error: string };

export async function createClientAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    companyName: formData.get("companyName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    notes: formData.get("notes"),
    paymentTermsDays: formData.get("paymentTermsDays"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { error } = await supabase.from("clients").insert({
    user_id: user.id,
    name: parsed.data.name,
    company_name: parsed.data.companyName || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    notes: parsed.data.notes || null,
    payment_terms_days: parsed.data.paymentTermsDays,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/clients");
  redirect("/clients");
}

export async function updateClientAction(clientId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    companyName: formData.get("companyName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    notes: formData.get("notes"),
    paymentTermsDays: formData.get("paymentTermsDays"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // .eq("user_id", user.id) here is extra defense, not the actual
  // security boundary — RLS already guarantees this row update is scoped
  // to the caller. Keeping it explicit means the query still reads
  // correctly in isolation, without relying on the reader to know RLS is
  // silently filtering behind the scenes.
  const { error } = await supabase
    .from("clients")
    .update({
      name: parsed.data.name,
      company_name: parsed.data.companyName || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
      payment_terms_days: parsed.data.paymentTermsDays,
    })
    .eq("id", clientId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect("/clients");
}

export async function archiveClientAction(clientId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { error } = await supabase
    .from("clients")
    .update({ archived: true })
    .eq("id", clientId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/clients");
  return { success: true };
}

export async function deleteClientAction(clientId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  // clients.id is referenced by invoices.client_id with ON DELETE RESTRICT
  // (see 0003_invoices.sql) specifically so this fails loudly instead of
  // silently orphaning invoice history — a client with any invoices must
  // be archived, not deleted.
  const { error } = await supabase.from("clients").delete().eq("id", clientId).eq("user_id", user.id);

  if (error) {
    return {
      success: false,
      error: error.code === "23503" ? "This client has invoices and can't be deleted — archive it instead." : error.message,
    };
  }

  revalidatePath("/clients");
  return { success: true };
}
