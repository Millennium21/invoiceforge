import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  accent?: "green" | "red" | "amber";
}) {
  const accentClass =
    accent === "green"
      ? "text-stamp-green"
      : accent === "red"
        ? "text-stamp-red"
        : accent === "amber"
          ? "text-stamp-amber"
          : "text-foreground";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={cn("font-mono text-2xl font-semibold tabular-nums", accentClass)}>{value}</div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
