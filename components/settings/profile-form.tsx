"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { updateProfileAction, updateLogoUrlAction } from "@/actions/profile";
import { canUseCustomBranding } from "@/lib/payments";
import type { Profile, SubscriptionTier } from "@/types";

export function ProfileForm({ profile, tier }: { profile: Profile; tier: SubscriptionTier }) {
  const [pending, setPending] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [logoUrl, setLogoUrl] = React.useState(profile.logo_url);
  const brandingAllowed = canUseCustomBranding(tier);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    const result = await updateProfileAction(formData);
    setPending(false);
    if (!result.success) toast.error(result.error);
    else toast.success("Settings saved");
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    // The "{user_id}/..." prefix is what the logos_owner_insert RLS policy
    // checks against auth.uid() — this path shape isn't cosmetic, it's the
    // actual security boundary for who can write here.
    const path = `${profile.id}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      setUploading(false);
      toast.error(uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("logos").getPublicUrl(path);

    const result = await updateLogoUrlAction(`${publicUrl}?v=${Date.now()}`);
    setUploading(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setLogoUrl(`${publicUrl}?v=${Date.now()}`);
    toast.success("Logo updated");
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">No logo</span>
          )}
        </div>
        <div>
          <Label htmlFor="logo" className="cursor-pointer text-sm font-medium text-primary hover:underline">
            {uploading ? "Uploading…" : brandingAllowed ? "Upload logo" : "Upload logo (Starter+)"}
          </Label>
          <input
            id="logo"
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={handleLogoUpload}
            disabled={uploading || !brandingAllowed}
          />
          <p className="text-xs text-muted-foreground">PNG, JPEG, SVG or WebP. Max 2MB.</p>
        </div>
      </div>

      <form action={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessName">Business name</Label>
            <Input id="businessName" name="businessName" defaultValue={profile.business_name ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">Your name</Label>
            <Input id="fullName" name="fullName" defaultValue={profile.full_name ?? ""} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="address">Business address</Label>
          <Textarea id="address" name="address" defaultValue={profile.address ?? ""} rows={2} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="taxNumber">Tax reference (UTR/VAT)</Label>
            <Input id="taxNumber" name="taxNumber" defaultValue={profile.tax_number ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="defaultTaxRate">Default tax rate (%)</Label>
            <Input
              id="defaultTaxRate"
              name="defaultTaxRate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={profile.default_tax_rate}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoicePrefix">Invoice number prefix</Label>
            <Input id="invoicePrefix" name="invoicePrefix" defaultValue={profile.invoice_prefix} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brandColor">Brand colour</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              id="brandColor"
              name="brandColor"
              defaultValue={profile.brand_color}
              className="h-10 w-14 cursor-pointer rounded border border-input bg-card"
              disabled={!brandingAllowed}
            />
            <span className="font-mono text-sm text-muted-foreground">{profile.brand_color}</span>
          </div>
        </div>

        <input type="hidden" name="defaultCurrency" value={profile.default_currency} />

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
