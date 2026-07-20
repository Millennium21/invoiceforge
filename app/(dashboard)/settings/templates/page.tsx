import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { TemplatesTable } from "@/components/templates/templates-table";

export const metadata: Metadata = { title: "Invoice templates" };

export default async function TemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: templates }, { data: profile }] = await Promise.all([
    supabase.from("invoice_templates").select("*, items:invoice_template_items(*)").eq("user_id", user!.id).order("name"),
    supabase.from("profiles").select("default_currency").eq("id", user!.id).single(),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invoice templates</h1>
          <p className="text-sm text-muted-foreground">Reusable line-item sets for invoices you send often.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/settings/templates/new">
            <Plus className="h-4 w-4" />
            New template
          </Link>
        </Button>
      </div>

      <TemplatesTable templates={templates ?? []} currency={profile?.default_currency ?? "GBP"} />
    </div>
  );
}
