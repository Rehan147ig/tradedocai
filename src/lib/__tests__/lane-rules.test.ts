import { describe, it, expect } from "vitest";
import { estimateLandedCost, inferLane, TRADE_LANES } from "@/lib/lane-rules";
import type { ExtractedTradeDocument } from "@/lib/validators";

function doc(buyer: string, seller: string): ExtractedTradeDocument {
  return { status: "needs_review", confidence: 50, document_type: "commercial_invoice", seller_country: seller, buyer_country: buyer, total_value: "1000", currency: "GBP", items: [{ description: "x", hs_code: "610910", hs_status: "valid", country_of_origin: "India", total_line_value: "1000" }], flags: [] };
}

describe("lane-rules", () => {
  it("infers india-uk", () => { expect(inferLane(doc("United Kingdom","India"))).toBe("india-uk"); });
  it("infers global fallback", () => { expect(inferLane(doc("Japan","Brazil"))).toBe("global"); });
  it("estimates landed cost deterministic", () => {
    const c = estimateLandedCost(doc("United Kingdom","India") as never, "india-uk");
    expect(c.estimatedDuty).toBeGreaterThan(0);
    expect(c.estimatedLandedCost).toBeGreaterThan(c.invoiceValue);
    expect(c.assumptions.length).toBeGreaterThan(0);
  });
  it("all lanes have duty/tax", () => {
    for (const k of Object.keys(TRADE_LANES)) expect(TRADE_LANES[k as keyof typeof TRADE_LANES].dutyRate).toBeGreaterThanOrEqual(0);
  });
});
