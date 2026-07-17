"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validations/profile";
import type { ActionResult } from "@/actions/clients";

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const parsed = profileSchema.safeParse({
    businessName: formData.get("businessName"),
    fullName: formData.get("fullName"),
    address: formData.get("address"),
    taxNumber: formData.get("taxNumber"),
    defaultCurrency: formData.get("defaultCurrency") || "GBP",
    defaultTaxRate: formData.get("defaultTaxRate") || 0,
    invoicePrefix: formData.get("invoicePrefix") || "INV-",
    brandColor: formData.get("brandColor") || "#2B4C6F",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      business_name: parsed.data.businessName || null,
      full_name: parsed.data.fullName || null,
      address: parsed.data.address || null,
      tax_number: parsed.data.taxNumber || null,
      default_currency: parsed.data.defaultCurrency,
      default_tax_rate: parsed.data.defaultTaxRate,
      invoice_prefix: parsed.data.invoicePrefix,
      brand_color: parsed.data.brandColor,
    })
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  return { success: true };
}

/**
 * Called after the browser has already uploaded the logo file directly to
 * Supabase Storage (see components/settings/branding-form.tsx) — this
 * action just persists the resulting public URL onto the profile row. The
 * upload itself goes straight from the browser to Storage using the
 * user's own session, so it's covered by the logos_owner_insert /
 * logos_owner_update RLS policies from 0006_storage_logos.sql.
 */
export async function updateLogoUrlAction(logoUrl: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { error } = await supabase.from("profiles").update({ logo_url: logoUrl }).eq("id", user.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  return { success: true };
}
