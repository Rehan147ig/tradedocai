import { describe, it, expect } from "vitest";
import { buildCarrierEdi } from "@/lib/carrier";

const doc = { invoice_number: "#1001", seller_name: "Acme", seller_country: "India", buyer_name: "John", buyer_address: "10 London", buyer_country: "United Kingdom", total_value: "100", currency: "GBP", incoterms: "DAP", confidence: 85, status: "needs_review", items: [{ description: "T-shirt", hs_code: "610910", hs_status: "valid", quantity: "2", unit_price: "50", country_of_origin: "India" }], flags: [] } as never;
const audit = { lane: "india-uk", carrierPayload: { recipient: { city: "London", zip: "SW1" } }, workflowId: "clearship-decision-v1", runId: "abc", steps: [] };

describe("carrier", () => {
  it("generic includes compliance", () => {
    const edi = buildCarrierEdi(doc, audit, { format: "generic" }) as Record<string, unknown>;
    expect((edi as Record<string, unknown>).reference).toBe("#1001");
    expect((edi as Record<string, unknown>).compliance).toBeDefined();
  });
  it("easyship maps hs sans dot", () => {
    const edi = buildCarrierEdi(doc, audit, { format: "easyship" }) as Record<string, unknown>;
    const es = (edi as Record<string, { parcels: Array<{ hs_code: string }> }>).easyship;
    expect(es.parcels[0].hs_code).toBe("610910");
  });
  it("dhl maps commodityCode", () => {
    const edi = buildCarrierEdi({ ...doc, items: [{ ...doc.items[0], hs_code: "6109.10" } as never] } as never, audit, { format: "dhl" }) as Record<string, unknown>;
    const dhl = (edi as Record<string, { lineItems: Array<{ commodityCode: string }> }>).dhl;
    expect(dhl.lineItems[0].commodityCode).toBe("610910");
  });
});
