import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PricingCards } from "@/components/billing/pricing-cards";
import { ManageSubscriptionButton } from "@/components/billing/manage-subscription-button";
import { PAYMENTS_ENABLED } from "@/lib/payments";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user!.id)
    .single();

  const tier = subscription?.tier ?? "free";

  if (!PAYMENTS_ENABLED) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="text-sm text-muted-foreground">Payments are currently disabled.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Everything is free</CardTitle>
            <CardDescription>
              This deployment is running in Zero-Cost Mode (<code className="font-mono">ENABLE_PAYMENTS=false</code>
              ) — every feature is fully unlocked for every user, with no limits and no subscription checks. See
              the README to turn on Starter/Pro billing.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">Manage your InvoiceForge subscription.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            Current plan
            <span
              className={
                tier === "free"
                  ? "stamp bg-stamp-ink-bg text-muted-foreground border-muted-foreground/40 capitalize"
                  : "stamp bg-stamp-green-bg text-stamp-green border-stamp-green/50 capitalize"
              }
            >
              {tier}
            </span>
          </CardTitle>
          {subscription?.current_period_end ? (
            <CardDescription>
              {subscription.cancel_at_period_end ? "Cancels" : "Renews"} on{" "}
              {formatDate(subscription.current_period_end)}
            </CardDescription>
          ) : null}
        </CardHeader>
        {tier !== "free" ? (
          <CardContent>
            <ManageSubscriptionButton />
          </CardContent>
        ) : null}
      </Card>

      <PricingCards currentTier={tier} />
    </div>
  );
}
