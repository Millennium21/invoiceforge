"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Send, Download, Link2, Copy, Trash2, Pencil, FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markInvoiceSentAction, duplicateInvoiceAction, deleteInvoiceAction } from "@/actions/invoices";
import { saveInvoiceAsTemplateAction } from "@/actions/templates";
import type { Invoice } from "@/types";

export function InvoiceActions({ invoice, publicUrl }: { invoice: Invoice; publicUrl: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleSend() {
    setPending(true);
    const result = await markInvoiceSentAction(invoice.id);
    setPending(false);
    if (!result.success) toast.error(result.error);
    else toast.success("Invoice sent");
    router.refresh();
  }

  async function handleDuplicate() {
    await duplicateInvoiceAction(invoice.id);
  }

  async function handleSaveAsTemplate() {
    const name = prompt("Name this template:", `${invoice.invoice_number} template`);
    if (!name) return;
    const result = await saveInvoiceAsTemplateAction(invoice.id, name);
    if (!result.success) toast.error(result.error);
    else toast.success("Template saved");
  }

  async function handleDelete() {
    if (!confirm("Delete this draft? This can't be undone.")) return;
    const result = await deleteInvoiceAction(invoice.id);
    if (!result.success) toast.error(result.error);
    else {
      toast.success("Draft deleted");
      router.push("/invoices");
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
    toast.success("Link copied");
  }

  return (
    <div className="flex flex-wrap gap-2">
      {invoice.status === "draft" ? (
        <>
          <Button asChild variant="outline" size="sm">
            <Link href={`/invoices/${invoice.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button size="sm" onClick={handleSend} disabled={pending}>
            <Send className="h-4 w-4" />
            {pending ? "Sending…" : "Send to client"}
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={copyLink}>
          <Link2 className="h-4 w-4" />
          Copy client link
        </Button>
      )}

      <Button asChild variant="outline" size="sm">
        <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer">
          <Download className="h-4 w-4" />
          PDF
        </a>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <span className="sr-only">More</span>⋯
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSaveAsTemplate}>
            <FileStack className="mr-2 h-4 w-4" />
            Save as template
          </DropdownMenuItem>
          {invoice.status === "draft" ? (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete draft
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
