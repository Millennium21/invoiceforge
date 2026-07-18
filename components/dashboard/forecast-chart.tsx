"use client";

import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";
import type { ForecastMonth } from "@/lib/forecast";

export function ForecastChart({ months, currency }: { months: ForecastMonth[]; currency: string }) {
  const data = months.map((m) => ({
    ...m,
    label: new Date(`${m.monthKey}-01`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatMoney(v, currency).replace(/\.00$/, "")}
          width={64}
        />
        <Tooltip
          formatter={(value, name) => [formatMoney(typeof value === "number" ? value : 0, currency), name]}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="recurringPence" stackId="a" name="Recurring (committed)" fill="var(--stamp-green)" radius={[0, 0, 0, 0]} />
        <Bar
          dataKey="projectedAdditionalPence"
          stackId="a"
          name="Projected additional"
          fill="var(--accent)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
