"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClientAction, updateClientAction } from "@/actions/clients";
import type { Client } from "@/types";

export function ClientForm({ client }: { client?: Client }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    const result = client
      ? await updateClientAction(client.id, formData)
      : await createClientAction(formData);
    setPending(false);
    if (result && !result.success) toast.error(result.error);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Contact name *</Label>
          <Input id="name" name="name" required defaultValue={client?.name} placeholder="Jane Smith" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="companyName">Company</Label>
          <Input
            id="companyName"
            name="companyName"
            defaultValue={client?.company_name ?? ""}
            placeholder="Acme Ltd"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={client?.email ?? ""}
            placeholder="jane@acme.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={client?.phone ?? ""} placeholder="+44 7700 900000" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" name="address" defaultValue={client?.address ?? ""} rows={2} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="paymentTermsDays">Default payment terms (days)</Label>
        <Input
          id="paymentTermsDays"
          name="paymentTermsDays"
          type="number"
          min={0}
          max={365}
          defaultValue={client?.payment_terms_days ?? 14}
          className="w-32"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={client?.notes ?? ""}
          rows={3}
          placeholder="Payment preferences, project context, anything worth remembering."
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : client ? "Save changes" : "Add client"}
        </Button>
      </div>
    </form>
  );
}
