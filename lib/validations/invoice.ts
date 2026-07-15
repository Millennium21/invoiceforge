import { z } from "zod";

export const lineItemSchema = z.object({
  id: z.string().optional(), // present when editing an existing item
  description: z.string().trim().min(1, "Description is required").max(500),
  quantity: z.coerce.number().positive("Must be greater than 0").max(1_000_000),
  unitPricePence: z.coerce.number().int().min(0).max(100_000_000), // £1,000,000 ceiling per line
});

export const invoiceSchema = z
  .object({
    clientId: z.string().uuid("Choose a client"),
    currency: z.string().length(3).default("GBP"),
    issueDate: z.string().min(1),
    dueDate: z.string().min(1),
    discountType: z.enum(["none", "percent", "fixed"]).default("none"),
    discountValue: z.coerce.number().min(0).default(0),
    taxRatePercent: z.coerce.number().min(0).max(100).default(0),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
    items: z.array(lineItemSchema).min(1, "Add at least one line item"),
    isRecurring: z.boolean().default(false),
    recurrenceInterval: z.enum(["weekly", "monthly", "quarterly", "yearly"]).optional(),
    recurrenceEndDate: z.string().optional().or(z.literal("")),
  })
  .refine((data) => !data.isRecurring || !!data.recurrenceInterval, {
    message: "Choose how often this invoice repeats",
    path: ["recurrenceInterval"],
  })
  .refine((data) => new Date(data.dueDate) >= new Date(data.issueDate), {
    message: "Due date must be on or after the issue date",
    path: ["dueDate"],
  });

export type InvoiceFormValues = z.infer<typeof invoiceSchema>;
export type LineItemFormValues = z.infer<typeof lineItemSchema>;
