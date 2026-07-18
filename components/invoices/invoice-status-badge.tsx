import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/types";

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-stamp-ink-bg text-muted-foreground border-muted-foreground/40" },
  sent: { label: "Sent", className: "bg-stamp-amber-bg text-stamp-amber border-stamp-amber/50" },
  viewed: { label: "Viewed", className: "bg-stamp-amber-bg text-stamp-amber border-stamp-amber/50" },
  paid: { label: "Paid", className: "bg-stamp-green-bg text-stamp-green border-stamp-green/50" },
  overdue: { label: "Overdue", className: "bg-stamp-red-bg text-stamp-red border-stamp-red/50" },
  cancelled: { label: "Cancelled", className: "bg-stamp-ink-bg text-muted-foreground border-muted-foreground/40" },
};

export function InvoiceStatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  const config = STATUS_CONFIG[status];
  return <span className={cn("stamp", config.className, className)}>{config.label}</span>;
}
