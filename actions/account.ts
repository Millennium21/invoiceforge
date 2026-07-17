"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/actions/clients";

/**
 * GDPR "right to erasure". Every tenant table has `on delete cascade` back
 * to auth.users (see the migrations), so deleting the auth user is enough
 * to remove the freelancer's entire data footprint — clients, invoices,
 * line items, payments, subscriptions, reminders — in one operation, with
 * the database (not application code remembering every table) guaranteeing
 * nothing is left behind.
 */
export async function deleteAccountAction(confirmation: string): Promise<ActionResult> {
  if (confirmation !== "DELETE") {
    return { success: false, error: 'Type "DELETE" to confirm.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) return { success: false, error: error.message };

  await supabase.auth.signOut();
  redirect("/?deleted=true");
}
