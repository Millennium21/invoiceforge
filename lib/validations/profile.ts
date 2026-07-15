import { z } from "zod";

export const profileSchema = z.object({
  businessName: z.string().trim().max(200).optional().or(z.literal("")),
  fullName: z.string().trim().max(200).optional().or(z.literal("")),
  address: z.string().trim().max(1000).optional().or(z.literal("")),
  taxNumber: z.string().trim().max(50).optional().or(z.literal("")),
  defaultCurrency: z.string().length(3).default("GBP"),
  defaultTaxRate: z.coerce.number().min(0).max(100).default(0),
  invoicePrefix: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and hyphens only")
    .default("INV-"),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Enter a hex colour like #2B4C6F")
    .default("#2B4C6F"),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export const signupSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  consent: z.literal(true, {
    message: "You must accept the Privacy Policy and Terms to continue",
  }),
});

export type SignupFormValues = z.infer<typeof signupSchema>;
