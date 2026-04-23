import { z } from "zod";

function isValidTimeZone(value: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const factorySettingsSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  timezone: z.string(),
  currency: z.string(),
  orderCodePrefix: z.string(),
  portalDisplayName: z.string().nullable(),
  supportEmail: z.string().nullable(),
  supportPhone: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  stats: z.object({
    totalOrders: z.number(),
    activeUsers: z.number(),
  }),
  previews: z.object({
    nextOrderCode: z.string(),
    portalDisplayNameResolved: z.string(),
  }),
});

export const updateFactorySettingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  timezone: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .refine(isValidTimeZone, "Use a valid IANA timezone, like Asia/Riyadh."),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code."),
  orderCodePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, "Prefix must be 2-8 letters or numbers."),
  portalDisplayName: z.string().trim().max(80).optional().or(z.literal("")),
  supportEmail: z.email().optional().or(z.literal("")),
  supportPhone: z.string().trim().max(30).optional().or(z.literal("")),
});

export type FactorySettingsSnapshot = z.infer<typeof factorySettingsSchema>;
export type UpdateFactorySettingsInput = z.infer<typeof updateFactorySettingsSchema>;
