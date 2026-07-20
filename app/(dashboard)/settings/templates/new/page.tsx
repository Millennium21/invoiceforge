import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplateForm } from "@/components/templates/template-form";

export const metadata: Metadata = { title: "New template" };

export default async function NewTemplatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("default_currency").eq("id", user!.id).single();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">New template</h1>
        <p className="text-sm text-muted-foreground">Save a line-item set you'll want to reuse.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Template details</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateForm defaultCurrency={profile?.default_currency ?? "GBP"} />
        </CardContent>
      </Card>
    </div>
  );
}
