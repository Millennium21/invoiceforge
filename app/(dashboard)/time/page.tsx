import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimerWidget } from "@/components/time/timer-widget";
import { TimeEntriesTable } from "@/components/time/time-entries-table";

export const metadata: Metadata = { title: "Time tracking" };

export default async function TimePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: clients }, { data: profile }, { data: running }, { data: entries }] = await Promise.all([
    supabase.from("clients").select("id, name, company_name").eq("user_id", user!.id).eq("archived", false).order("name"),
    supabase.from("profiles").select("default_currency").eq("id", user!.id).single(),
    supabase
      .from("time_entries")
      .select("*, client:clients(name, company_name)")
      .eq("user_id", user!.id)
      .is("ended_at", null)
      .maybeSingle(),
    supabase
      .from("time_entries")
      .select("*, client:clients(name, company_name)")
      .eq("user_id", user!.id)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Time tracking</h1>
        <p className="text-sm text-muted-foreground">Track billable hours and turn them into invoice line items.</p>
      </div>

      <TimerWidget runningEntry={running ?? null} clients={clients ?? []} currency={profile?.default_currency ?? "GBP"} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent entries</CardTitle>
        </CardHeader>
        <CardContent>
          <TimeEntriesTable entries={entries ?? []} currency={profile?.default_currency ?? "GBP"} />
        </CardContent>
      </Card>
    </div>
  );
}
