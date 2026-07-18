"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startTimerAction, stopTimerAction } from "@/actions/time-entries";
import { parseMoneyToPence, formatMoney } from "@/lib/money";
import type { Client, TimeEntry } from "@/types";

function useElapsed(startedAt: string | null) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function TimerWidget({
  runningEntry,
  clients,
  currency,
}: {
  runningEntry: (TimeEntry & { client: Pick<Client, "name" | "company_name"> | null }) | null;
  clients: Pick<Client, "id" | "name" | "company_name">[];
  currency: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [clientId, setClientId] = React.useState(clients[0]?.id ?? "");
  const [description, setDescription] = React.useState("");
  const [rateDisplay, setRateDisplay] = React.useState("50.00");

  const elapsedSeconds = useElapsed(runningEntry?.started_at ?? null);

  async function handleStart() {
    setPending(true);
    const result = await startTimerAction(clientId, description, parseMoneyToPence(rateDisplay));
    setPending(false);
    if (!result.success) toast.error(result.error);
    router.refresh();
  }

  async function handleStop() {
    if (!runningEntry) return;
    setPending(true);
    const result = await stopTimerAction(runningEntry.id);
    setPending(false);
    if (!result.success) toast.error(result.error);
    router.refresh();
  }

  if (runningEntry) {
    const earnedPence = Math.round((elapsedSeconds / 3600) * runningEntry.hourly_rate_pence);
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-stamp-green/40 bg-stamp-green-bg p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-stamp-green">Running</p>
          <p className="font-mono text-3xl font-semibold tabular-nums text-stamp-green">
            {formatElapsed(elapsedSeconds)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {runningEntry.description || "Untitled"}
            {runningEntry.client ? ` · ${runningEntry.client.company_name || runningEntry.client.name}` : ""}
            {" · "}
            {formatMoney(earnedPence, currency)} so far
          </p>
        </div>
        <Button variant="destructive" onClick={handleStop} disabled={pending} size="lg">
          <Square className="h-4 w-4" />
          Stop
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">What are you working on?</label>
        <Input
          placeholder="Describe the task"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="w-full sm:w-48">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Client</label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger>
            <SelectValue placeholder="No client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.company_name || c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full sm:w-32">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Rate/hr</label>
        <Input type="number" min="0" step="0.01" value={rateDisplay} onChange={(e) => setRateDisplay(e.target.value)} />
      </div>
      <Button onClick={handleStart} disabled={pending} size="lg">
        <Play className="h-4 w-4" />
        Start
      </Button>
    </div>
  );
}
