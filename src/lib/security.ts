import { z } from "zod";

export const shopDomainSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i, "Invalid shop domain");
export const ingestOrderSchema = z.object({
  shopDomain: z.string().optional(),
  lane: z.string().optional(),
  order: z.object({
    id: z.union([z.string(), z.number()]),
    name: z.string().optional(),
    currency: z.string().optional(),
    total_price: z.string().optional(),
    line_items: z.array(z.object({
      title: z.string().optional(),
      name: z.string().optional(),
      quantity: z.number().optional(),
      price: z.string().optional(),
      sku: z.string().nullable().optional(),
    })).optional(),
    shipping_address: z.record(z.string(), z.unknown()).optional().nullable(),
  }).passthrough(),
});

export function sanitizeString(s: string, maxLen = 500): string {
  return s.slice(0, maxLen).replace(/[<>]/g, "");
}

export function strongSecretCheck(secret: string | undefined): boolean {
  return Boolean(secret && secret.length >= 32 && !secret.includes("change-this"));
}
