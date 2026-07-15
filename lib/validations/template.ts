import { z } from "zod";
import { lineItemSchema } from "@/lib/validations/invoice";

export const templateSchema = z.object({
  name: z.string().trim().min(1, "Give the template a name").max(200),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  discountType: z.enum(["none", "percent", "fixed"]).default("none"),
  discountValue: z.coerce.number().min(0).default(0),
  taxRatePercent: z.coerce.number().min(0).max(100).optional(),
  items: z.array(lineItemSchema).min(1, "Add at least one line item"),
});

export type TemplateFormValues = z.infer<typeof templateSchema>;

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Write a message first").max(2000),
});
