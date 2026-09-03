import { describe, it, expect } from "vitest";
import { shopifyOrderToExtractedDoc, buildCarrierPayload } from "@/lib/shopify/transform";

describe("shopify transform", () => {
  it("maps Shopify order to ExtractedDoc", () => {
    const order = { id: 123, name: "#1001", currency: "GBP", total_price: "100.00", line_items: [{ title: "T-shirt", quantity: 2, price: "50.00", sku: "TSH-001" }], shipping_address: { first_name: "John", last_name: "Doe", address1: "10 Main", city: "London", country: "United Kingdom", zip: "SW1A1AA" } } as never;
    const doc = shopifyOrderToExtractedDoc(order);
    expect(doc.buyer_country).toBe("United Kingdom");
    expect(doc.items[0].description).toBe("T-shirt");
    expect(doc.total_value).toBe("100.00");
  });
  it("buildCarrierPayload deterministic", () => {
    const order = { id: 1, shipping_address: { city: "Paris", country: "France" } } as never;
    const doc = { buyer_name: "Marie", buyer_address: "10 Rue", buyer_country: "France", total_value: "90", currency: "EUR", incoterms: "DAP", items: [{ description: "Serum", hs_code: "330499", hs_status: "valid", quantity: "1", unit_price: "90", country_of_origin: "India" }], trade_lane: "global" } as never;
    const payload = buildCarrierPayload(doc, order);
    expect(payload.recipient.country).toBe("France");
    expect(payload.parcels[0].hs_code).toBe("330499");
  });
});
