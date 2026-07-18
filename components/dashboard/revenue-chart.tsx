"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";

interface RevenuePoint {
  month: string;
  revenuePence: number;
}

export function RevenueChart({ data, currency }: { data: RevenuePoint[]; currency: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Revenue, last 6 months</CardTitle>
      </CardHeader>
      <CardContent className="pl-0">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <XAxis
              dataKey="month"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatMoney(v, currency).replace(/\.00$/, "")}
              width={64}
            />
            <Tooltip
              formatter={(value) => formatMoney(typeof value === "number" ? value : 0, currency)}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Bar dataKey="revenuePence" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
