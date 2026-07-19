"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCheckoutSessionAction } from "@/actions/billing";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SubscriptionTier } from "@/types";

const PLANS: {
  tier: "starter" | "pro";
  name: string;
  price: string;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    tier: "starter",
    name: "Starter",
    price: "£7/mo",
    features: ["Unlimited invoices", "Custom branding", "Recurring invoices", "Email reminders"],
  },
  {
    tier: "pro",
    name: "Pro",
    price: "£14/mo",
    features: ["Everything in Starter", "Advanced reports", "Priority support"],
    highlight: true,
  },
];

export function PricingCards({ currentTier }: { currentTier: SubscriptionTier }) {
  const [loadingTier, setLoadingTier] = React.useState<string | null>(null);

  async function handleUpgrade(tier: "starter" | "pro") {
    setLoadingTier(tier);
    const result = await createCheckoutSessionAction(tier);
    setLoadingTier(null);
    if (result && !result.success) toast.error(result.error);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {PLANS.map((plan) => {
        const isCurrent = currentTier === plan.tier;
        return (
          <Card key={plan.tier} className={cn(plan.highlight && "border-primary")}>
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between text-base">
                {plan.name}
                <span className="font-mono text-lg">{plan.price}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-stamp-green" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleUpgrade(plan.tier)}
                disabled={isCurrent || loadingTier !== null}
                variant={plan.highlight ? "default" : "outline"}
              >
                {isCurrent ? "Current plan" : loadingTier === plan.tier ? "Redirecting…" : `Upgrade to ${plan.name}`}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
