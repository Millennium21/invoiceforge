"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteAccountAction } from "@/actions/account";

export function AccountDangerZone() {
  const [confirmation, setConfirmation] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteAccountAction(confirmation);
    setDeleting(false);
    if (!result.success) toast.error(result.error);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Export your data</CardTitle>
          <CardDescription>
            Download everything InvoiceForge has stored about you — profile, clients, invoices, and payment
            history — as JSON, per UK GDPR's right to data portability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="/api/account/export" download>
              <Download className="h-4 w-4" />
              Download my data
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-destructive">Delete account</CardTitle>
          <CardDescription>
            Permanently deletes your account and every client, invoice, and payment record tied to it. This
            cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4" />
                Delete my account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription>
                  This permanently deletes your account and all associated data. Type{" "}
                  <span className="font-mono font-semibold">DELETE</span> to confirm.
                </DialogDescription>
              </DialogHeader>
              <Input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="DELETE"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" disabled={confirmation !== "DELETE" || deleting} onClick={handleDelete}>
                  {deleting ? "Deleting…" : "Permanently delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
