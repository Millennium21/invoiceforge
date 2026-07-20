import type { Metadata } from "next";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ForecastChart } from "@/components/dashboard/forecast-chart";
import { formatMoney } from "@/lib/money";
import { computeRevenueForecast } from "@/lib/forecast";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_currency")
    .eq("id", user!.id)
    .single();
  const currency = profile?.default_currency || "GBP";

  const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();

  const { data: payments } = await supabase
    .from("payments")
    .select("paid_at, amount_pence, invoice:invoices(tax_pence, subtotal_pence)")
    .eq("user_id", user!.id)
    .gte("paid_at", startOfYear)
    .order("paid_at", { ascending: true });

  const monthly = new Map<string, { grossPence: number; taxPence: number; count: number }>();
  for (const p of payments ?? []) {
    const key = new Date(p.paid_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const invoice = Array.isArray(p.invoice) ? p.invoice[0] : p.invoice;
    const existing = monthly.get(key) ?? { grossPence: 0, taxPence: 0, count: 0 };
    existing.grossPence += p.amount_pence;
    existing.taxPence += invoice?.tax_pence ?? 0;
    existing.count += 1;
    monthly.set(key, existing);
  }

  const rows = Array.from(monthly.entries());
  const yearTotal = rows.reduce((sum, [, v]) => sum + v.grossPence, 0);
  const yearTax = rows.reduce((sum, [, v]) => sum + v.taxPence, 0);

  // --- Forecast inputs -------------------------------------------------
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const [{ data: recurringTemplates }, { data: recentPayments }] = await Promise.all([
    supabase
      .from("invoices")
      .select("total_pence, recurrence_interval, next_invoice_date, recurrence_end_date")
      .eq("user_id", user!.id)
      .eq("is_recurring", true)
      .not("next_invoice_date", "is", null),
    supabase.from("payments").select("amount_pence, paid_at").eq("user_id", user!.id).gte("paid_at", threeMonthsAgo.toISOString()),
  ]);

  const historicalByMonth = new Map<string, number>();
  for (const p of recentPayments ?? []) {
    const key = new Date(p.paid_at).toISOString().slice(0, 7);
    historicalByMonth.set(key, (historicalByMonth.get(key) ?? 0) + p.amount_pence);
  }

  const forecastMonths = computeRevenueForecast(
    (recurringTemplates ?? []).map((t) => ({
      totalPence: t.total_pence,
      interval: t.recurrence_interval!,
      nextInvoiceDate: t.next_invoice_date!,
      recurrenceEndDate: t.recurrence_end_date,
    })),
    Array.from(historicalByMonth.values()),
    6,
    new Date()
  );

  const forecastTotal = forecastMonths.reduce((sum, m) => sum + m.totalPence, 0);
  const forecastCommitted = forecastMonths.reduce((sum, m) => sum + m.recurringPence, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Not legal or tax advice — check with an accountant before filing or making decisions based on the
            forecast.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/api/reports/csv" download>
            <Download className="h-4 w-4" />
            Export CSV
          </a>
        </Button>
      </div>

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Year to date
                </CardTitle>
              </CardHeader>
              <CardContent className="font-mono text-2xl font-semibold tabular-nums">
                {formatMoney(yearTotal, currency)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tax collected
                </CardTitle>
              </CardHeader>
              <CardContent className="font-mono text-2xl font-semibold tabular-nums">
                {formatMoney(yearTax, currency)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Monthly breakdown</CardTitle>
              <CardDescription>Based on when payments were received, not when invoices were issued.</CardDescription>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No payments received yet this year.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {rows.map(([month, v]) => (
                    <div key={month} className="flex items-center justify-between py-2.5 text-sm">
                      <span>{month}</span>
                      <span className="text-xs text-muted-foreground">
                        {v.count} payment{v.count === 1 ? "" : "s"}
                      </span>
                      <span className="font-mono tabular-nums">{formatMoney(v.grossPence, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast" className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Next 6 months, committed
                </CardTitle>
              </CardHeader>
              <CardContent className="font-mono text-2xl font-semibold tabular-nums text-stamp-green">
                {formatMoney(forecastCommitted, currency)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Next 6 months, total forecast
                </CardTitle>
              </CardHeader>
              <CardContent className="font-mono text-2xl font-semibold tabular-nums">
                {formatMoney(forecastTotal, currency)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Revenue forecast</CardTitle>
              <CardDescription>
                Green is revenue from active recurring invoices already scheduled to generate — about as close to
                committed as freelance income gets. Blue is a flat projection from your last 3 months of actual
                payments, which is a guess, not a promise.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ForecastChart months={forecastMonths} currency={currency} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
