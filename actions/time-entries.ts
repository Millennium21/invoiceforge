"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { timeEntrySchema } from "@/lib/validations/time-entry";
import type { ActionResult } from "@/actions/clients";

export async function startTimerAction(clientId: string, description: string, hourlyRatePence: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Not signed in." };

  // The time_entries_one_running_per_user unique index (0010_time_entries.sql)
  // is the real guard here — this check just gives a friendlier error
  // message than a raw Postgres unique-violation would.
  const { data: running } = await supabase
    .from("time_entries")
    .select("id")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  if (running) return { success: false as const, error: "You already have a timer running." };

  const { error } = await supabase.from("time_entries").insert({
    user_id: user.id,
    client_id: clientId || null,
    description: description || "",
    hourly_rate_pence: hourlyRatePence,
  });

  if (error) return { success: false as const, error: error.message };

  revalidatePath("/time");
  return { success: true as const };
}

export async function stopTimerAction(entryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { error } = await supabase
    .from("time_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", entryId)
    .eq("user_id", user.id)
    .is("ended_at", null);

  if (error) return { success: false, error: error.message };

  revalidatePath("/time");
  return { success: true };
}

export async function createManualTimeEntryAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const parsed = timeEntrySchema.safeParse({
    clientId: formData.get("clientId"),
    description: formData.get("description"),
    hourlyRatePence: formData.get("hourlyRatePence"),
    startedAt: formData.get("startedAt"),
    endedAt: formData.get("endedAt"),
    isBillable: formData.get("isBillable") === "on",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  if (new Date(parsed.data.endedAt) < new Date(parsed.data.startedAt)) {
    return { success: false, error: "End time must be after the start time." };
  }

  const { error } = await supabase.from("time_entries").insert({
    user_id: user.id,
    client_id: parsed.data.clientId || null,
    description: parsed.data.description || "",
    hourly_rate_pence: parsed.data.hourlyRatePence,
    started_at: parsed.data.startedAt,
    ended_at: parsed.data.endedAt,
    is_billable: parsed.data.isBillable,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/time");
  return { success: true };
}

export async function deleteTimeEntryAction(entryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { error } = await supabase.from("time_entries").delete().eq("id", entryId).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/time");
  return { success: true };
}

export async function getUnbilledTimeEntries(clientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("time_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("client_id", clientId)
    .eq("is_billable", true)
    .is("invoice_id", null)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false });

  return data ?? [];
}
