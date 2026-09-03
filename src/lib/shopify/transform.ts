import { ExtractedTradeDocument } from "@/lib/validators";

export interface ShopifyOrderPayload {
  id: number | string;
  name?: string;
  order_number?: number;
  email?: string;
  currency?: string;
  total_price?: string;
  subtotal_price?: string;
  total_tax?: string;
  financial_status?: string;
  fulfillment_status?: string | null;
  created_at?: string;
  shipping_address?: Record<string, unknown> | null;
  billing_address?: Record<string, unknown> | null;
  line_items?: Array<{
    id?: number | string;
    sku?: string | null;
    name?: string | null;
    title?: string | null;
    quantity?: number;
    price?: string;
    grams?: number;
    vendor?: string | null;
    product_id?: number | string | null;
    variant_id?: number | string | null;
  }>;
  shipping_lines?: Array<{ title?: string; price?: string }>;
  customer?: Record<string, unknown> | null;
}

export function shopifyOrderToExtractedDoc(order: ShopifyOrderPayload): ExtractedTradeDocument {
  const shipping = order.shipping_address as Record<string, string> | null;
  const billing = order.billing_address as Record<string, string> | null;
  const buyerCountry = (shipping?.country ?? billing?.country ?? null) as string | null;
  const buyerName = shipping ? `${shipping.first_name ?? ""} ${shipping.last_name ?? ""}`.trim() || (shipping.name as string) : (billing?.name as string) ?? null;
  const buyerAddr = shipping ? [shipping.address1, shipping.city, shipping.province, shipping.zip, shipping.country].filter(Boolean).join(", ") : null;

  const items = (order.line_items ?? []).map((li) => ({
    description: String(li.title ?? li.name ?? "Shopify line item"),
    quantity: String(li.quantity ?? ""),
    unit_price: String(li.price ?? ""),
    total_line_value: String(Number(li.price ?? 0) * Number(li.quantity ?? 1)),
    hs_code: null,
    hs_status: "missing" as const,
    country_of_origin: null,
    unit_of_measure: "pcs",
    net_weight: li.grams ? String(li.grams / 1000) : null,
    gross_weight: li.grams ? String(li.grams / 1000) : null,
    sku: li.sku ?? null,
    vendor: li.vendor ?? null,
  }));

  // Fallback if no line items
  const safeItems = items.length ? items : [{ description: "Shopify order", quantity: "1", unit_price: order.total_price ?? null, total_line_value: order.total_price ?? null, hs_code: null, hs_status: "missing" as const, country_of_origin: null }];

  return {
    status: "needs_review",
    confidence: 55,
    document_type: "commercial_invoice",
    invoice_number: order.name ?? String(order.id),
    invoice_date: order.created_at ? order.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
    seller_name: null, // filled from Shop + User
    seller_address: null,
    seller_country: null,
    buyer_name: buyerName,
    buyer_address: buyerAddr,
    buyer_country: buyerCountry,
    eori_number: null,
    vat_number: null,
    total_value: order.total_price ?? null,
    currency: order.currency ?? null,
    incoterms: "DAP",
    items: safeItems as unknown as ExtractedTradeDocument["items"],
    flags: [],
  };
}

export function extractDestination(order: ShopifyOrderPayload) {
  const addr = order.shipping_address ?? order.billing_address;
  return {
    country: (addr as Record<string, string> | null)?.country ?? null,
    province: (addr as Record<string, string> | null)?.province ?? null,
    city: (addr as Record<string, string> | null)?.city ?? null,
    zip: (addr as Record<string, string> | null)?.zip ?? null,
  };
}

export function buildCarrierPayload(decision: ExtractedTradeDocument, order: ShopifyOrderPayload) {
  const addr = (order.shipping_address ?? order.billing_address) as Record<string, string> | null;
  return {
    recipient: {
      name: decision.buyer_name,
      address: decision.buyer_address,
      country: decision.buyer_country,
      city: addr?.city ?? null,
      zip: addr?.zip ?? null,
      province: addr?.province ?? null,
    },
    parcels: decision.items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      hs_code: it.hs_code,
      country_of_origin: it.country_of_origin,
      weight_kg: it.gross_weight ?? it.net_weight ?? null,
    })),
    declared_value: decision.total_value,
    currency: decision.currency,
    incoterms: decision.incoterms,
    lane: (decision as unknown as Record<string, unknown>).trade_lane ?? null,
  };
}
