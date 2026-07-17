"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { messageSchema } from "@/lib/validations/template";
import type { ActionResult } from "@/actions/clients";

/**
 * Public side: reached from /invoice/[token], no session. `sender` is
 * hard-coded to "client" here — never read from the form — exactly the
 * same reasoning as the RLS policy that only lets an authenticated
 * freelancer insert with sender = 'freelancer' (0011_client_messages.sql).
 * Two independent layers agreeing that a client can never post as the
 * freelancer, neither of which trusts the other to catch it.
 */
export async function postClientMessageAction(token: string, formData: FormData): Promise<ActionResult> {
  const parsed = messageSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid message." };

  const admin = createAdminClient();
  const { data: invoice } = await admin.from("invoices").select("id, user_id").eq("public_token", token).single();
  if (!invoice) return { success: false, error: "Invoice not found." };

  const { error } = await admin.from("invoice_messages").insert({
    invoice_id: invoice.id,
    user_id: invoice.user_id,
    sender: "client",
    body: parsed.data.body,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function postFreelancerReplyAction(invoiceId: string, formData: FormData): Promise<ActionResult> {
  const parsed = messageSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid message." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { error } = await supabase.from("invoice_messages").insert({
    invoice_id: invoiceId,
    user_id: user.id,
    sender: "freelancer",
    body: parsed.data.body,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/invoices/${invoiceId}`);
  return { success: true };
}

export async function markMessagesReadAction(invoiceId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("invoice_messages")
    .update({ read_by_freelancer_at: new Date().toISOString() })
    .eq("invoice_id", invoiceId)
    .eq("user_id", user.id)
    .eq("sender", "client")
    .is("read_by_freelancer_at", null);
}
