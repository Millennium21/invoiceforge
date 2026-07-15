import { z } from "zod";

export const expenseSchema = z.object({
  clientId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().min(1, "Description is required").max(500),
  category: z.enum(["travel", "software", "materials", "subcontractor", "other"]).default("other"),
  amountPence: z.coerce.number().int().min(0, "Amount can't be negative").max(100_000_000),
  expenseDate: z.string().min(1),
  isBillable: z.boolean().default(false),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;
