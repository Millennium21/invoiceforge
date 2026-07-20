import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/settings/profile-form";
import { AccountDangerZone } from "@/components/settings/account-danger-zone";
import { Button } from "@/components/ui/button";
import { CreditCard, FileStack } from "lucide-react";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("subscriptions").select("tier").eq("user_id", user!.id).single(),
  ]);

  if (!profile) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">Your business profile, branding, and account.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/templates">
              <FileStack className="h-4 w-4" />
              Templates
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/billing">
              <CreditCard className="h-4 w-4" />
              Billing
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Business profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} tier={subscription?.tier ?? "free"} />
        </CardContent>
      </Card>

      <AccountDangerZone />
    </div>
  );
}
