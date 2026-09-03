import { describe, it, expect } from "vitest";
import { validateTradeDocument } from "@/lib/validators";
import type { ExtractedTradeDocument } from "@/lib/validators";

function base(): ExtractedTradeDocument {
  return {
    status: "needs_review", confidence: 80, document_type: "commercial_invoice",
    invoice_number: "INV-1", buyer_country: "United Kingdom", buyer_name: "John",
    seller_name: "S", total_value: "100", currency: "GBP", incoterms: "DAP",
    eori_number: "GB123456789012", vat_number: "GB123456789",
    items: [{ description: "T-shirt", hs_code: "610910", hs_status: "valid", country_of_origin: "India", quantity: "1", unit_price: "100", total_line_value: "100" }],
    flags: [],
  };
}

describe("validators", () => {
  it("flags missing EORI", () => {
    const d = { ...base(), eori_number: null } as ExtractedTradeDocument;
    const v = validateTradeDocument(d);
    expect(v.flags.some(f=>f.field==="eori_number" && f.severity==="error")).toBe(true);
    expect(v.status).toBe("critical_issues");
  });
  it("flags invalid EORI format", () => {
    const d = { ...base(), eori_number: "BAD" } as ExtractedTradeDocument;
    const v = validateTradeDocument(d);
    expect(v.eori_valid).toBe(false);
  });
  it("flags missing HS", () => {
    const d = { ...base(), items: [{ ...base().items[0], hs_code: null, hs_status: "missing" } as never] };
    const v = validateTradeDocument(d);
    expect(v.flags.some(f=>f.field.includes("hs_code"))).toBe(true);
  });
  it("flags invalid HS format", () => {
    const d = { ...base(), items: [{ ...base().items[0], hs_code: "12", hs_status: "valid" } as never] };
    const v = validateTradeDocument(d);
    expect(v.flags.some(f=>f.title.includes("Invalid HS"))).toBe(true);
  });
  it("ready when no errors", () => {
    const v = validateTradeDocument(base());
    expect(v.status).toBe("ready_to_ship");
  });
});
