import { describe, it, expect } from "vitest";
import { runRuleEngine, extractRuleFieldsFromText } from "@/lib/rule-engine";
import type { ExtractedTradeDocument } from "@/lib/validators";

function doc(overrides: Partial<ExtractedTradeDocument> = {}): ExtractedTradeDocument {
  return {
    status: "needs_review", confidence: 50, document_type: "commercial_invoice",
    invoice_number: "INV-1", invoice_date: new Date().toISOString().slice(0,10),
    seller_name: "Acme India", seller_country: "India",
    buyer_name: "John UK", buyer_country: "United Kingdom",
    eori_number: "GB123456789012", currency: "GBP", total_value: "1000", incoterms: "DAP",
    items: [{ description: "Cotton t-shirt 100% cotton crew neck", quantity: "10", unit_price: "100", total_line_value: "1000", hs_code: "610910", hs_status: "valid", country_of_origin: "India", unit_of_measure: "pcs", net_weight: "5", gross_weight: "5.5" }],
    flags: [], port_of_loading: "Mumbai", port_of_discharge: "London", vat_number: "GB999999973",
    ...overrides,
  };
}

describe("rule-engine", () => {
  it("passes valid doc (>80 score, 0 critical)", () => {
    const r = runRuleEngine(doc());
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.status).toBe("ready");
    expect(r.passed).toBe(true);
  });
  it("flags missing HS as critical", () => {
    const d = doc({ items: [{ ...doc().items[0], hs_code: "", hs_status: "missing" } as never] });
    const r = runRuleEngine(d);
    expect(r.flags.some(f=>f.field==="hs_code" && f.severity==="critical")).toBe(true);
  });
  it("flags vague description", () => {
    const d = doc({ items: [{ ...doc().items[0], description: "goods" } as never] });
    const r = runRuleEngine(d);
    expect(r.flags.some(f=>f.field==="product_description" && f.severity==="critical")).toBe(true);
  });
  it("flags missing incoterms", () => {
    const r = runRuleEngine(doc({ incoterms: null }));
    expect(r.flags.some(f=>f.field==="incoterms")).toBe(true);
  });
  it("scores high-risk when many critical", () => {
    const r = runRuleEngine(doc({ seller_name: null, buyer_name: null, currency: null, incoterms: null, items: [{ description: "goods", hs_code: "", hs_status: "missing", country_of_origin: null } as never] }));
    expect(r.status).toBe("high-risk");
    expect(r.score).toBeLessThan(50);
  });
  it("extractRuleFieldsFromText deterministic", () => {
    const t = "Invoice INV-2024 Seller: Raj Exports Buyer: Smith UK HS 6109.10 Total 500 GBP Origin India";
    const ex = extractRuleFieldsFromText(t);
    expect(ex.invoice_number).toBeTruthy();
    expect(ex.items[0].hs_code).toBeTruthy();
  });
});
