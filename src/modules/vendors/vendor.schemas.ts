import { z } from "zod";

// ────────────────────────────────────────────────────────────
// Input schemas
// ────────────────────────────────────────────────────────────
export const VendorContactInput = z.object({
  name: z.string().min(2).max(120),
  role: z.string().max(120).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  isPrimary: z.boolean().optional(),
});
export type VendorContactInputType = z.infer<typeof VendorContactInput>;

export const CreateVendorInput = z.object({
  name: z.string().min(2).max(200),
  code: z.string().max(40).optional(),
  taxNumber: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
  preferredCurrency: z.string().min(3).max(8).optional(),
  notes: z.string().max(2000).optional(),
  contacts: z.array(VendorContactInput).optional(),
});
export type CreateVendorInputType = z.infer<typeof CreateVendorInput>;

export const UpdateVendorInput = CreateVendorInput.partial().omit({
  contacts: true,
});
export type UpdateVendorInputType = z.infer<typeof UpdateVendorInput>;

// ────────────────────────────────────────────────────────────
// Result types
// ────────────────────────────────────────────────────────────
export type VendorContactDetail = {
  id: string;
  vendorId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VendorListItem = {
  id: string;
  factoryId: string;
  name: string;
  normalizedName: string;
  code: string | null;
  taxNumber: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contactCount: number;
  lastUsedAt: string | null;
};

export type VendorDetail = VendorListItem & {
  website: string | null;
  address: string | null;
  paymentTermsDays: number | null;
  preferredCurrency: string | null;
  notes: string | null;
  contacts: VendorContactDetail[];
};

export type VendorPerformance = {
  totalSpend: string;
  costCount: number;
  lastUsedAt: string | null;
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
export function normalizeVendorName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
