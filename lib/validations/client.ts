import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  companyName: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  address: z.string().trim().max(1000).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(14),
});

export type ClientFormValues = z.infer<typeof clientSchema>;
