"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createPortalSessionAction } from "@/actions/billing";

export function ManageSubscriptionButton() {
  const [pending, setPending] = React.useState(false);

  async function handleClick() {
    setPending(true);
    const result = await createPortalSessionAction();
    setPending(false);
    if (result && !result.success) toast.error(result.error);
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? "Opening…" : "Manage billing"}
    </Button>
  );
}
