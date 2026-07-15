import { z } from "zod";

export const timeEntrySchema = z.object({
  clientId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  hourlyRatePence: z.coerce.number().int().min(0).max(1_000_000),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  isBillable: z.boolean().default(true),
});

export type TimeEntryFormValues = z.infer<typeof timeEntrySchema>;
