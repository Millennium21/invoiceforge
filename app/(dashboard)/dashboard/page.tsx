import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { RecentInvoicesTable } from "@/components/dashboard/recent-invoices-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { PoundSterling, Clock, CalendarRange, TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_currency")
    .eq("id", userId)
    .single();
  const currency = profile?.default_currency || "GBP";

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  const sevenDaysOut = new Date();
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

  const [outstandingRes, paidThisMonthRes, upcomingRes, sixMonthPaymentsRes, recentInvoicesRes] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("total_pence")
        .eq("user_id", userId)
        .in("status", ["sent", "viewed", "overdue"]),
      supabase
        .from("payments")
        .select("amount_pence")
        .eq("user_id", userId)
        .gte("paid_at", startOfMonth.toISOString()),
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("status", ["sent", "viewed"])
        .lte("due_date", sevenDaysOut.toISOString().slice(0, 10)),
      supabase
        .from("payments")
        .select("amount_pence, paid_at")
        .eq("user_id", userId)
        .gte("paid_at", sixMonthsAgo.toISOString()),
      supabase
        .from("invoices")
        .select("*, client:clients(name, company_name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const outstandingPence = (outstandingRes.data ?? []).reduce((sum, r) => sum + r.total_pence, 0);
  const paidThisMonthPence = (paidThisMonthRes.data ?? []).reduce((sum, r) => sum + r.amount_pence, 0);
  const upcomingCount = upcomingRes.count ?? 0;

  // Group payments into calendar months for the chart. Six months of a
  // freelancer's payment history is small enough that doing this in JS
  // beats a raw SQL date_trunc RPC for readability.
  const monthBuckets = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleDateString("en-GB", { month: "short" });
    monthBuckets.set(key, 0);
  }
  for (const payment of sixMonthPaymentsRes.data ?? []) {
    const key = new Date(payment.paid_at).toLocaleDateString("en-GB", { month: "short" });
    if (monthBuckets.has(key)) {
      monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + payment.amount_pence);
    }
  }
  const chartData = Array.from(monthBuckets.entries()).map(([month, revenuePence]) => ({
    month,
    revenuePence,
  }));

  const totalSixMonthRevenue = chartData.reduce((sum, d) => sum + d.revenuePence, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">A snapshot of where your invoicing stands today.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Outstanding"
          value={formatMoney(outstandingPence, currency)}
          icon={PoundSterling}
          hint="Sent, viewed, or overdue"
        />
        <StatCard
          label="Paid this month"
          value={formatMoney(paidThisMonthPence, currency)}
          icon={TrendingUp}
          accent="green"
        />
        <StatCard
          label="Due within 7 days"
          value={String(upcomingCount)}
          icon={Clock}
          accent={upcomingCount > 0 ? "amber" : undefined}
          hint="Invoices to keep an eye on"
        />
        <StatCard
          label="6-month revenue"
          value={formatMoney(totalSixMonthRevenue, currency)}
          icon={CalendarRange}
        />
      </div>

      <RevenueChart data={chartData} currency={currency} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentInvoicesTable invoices={recentInvoicesRes.data ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
