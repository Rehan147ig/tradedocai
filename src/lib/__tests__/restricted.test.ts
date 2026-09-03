import { describe, it, expect } from "vitest";
import { checkRestricted } from "@/lib/restricted";
import type { ExtractedTradeDocument } from "@/lib/validators";

function doc(desc: string, buyer: string, hs: string | null = null): ExtractedTradeDocument {
  return { status: "needs_review", confidence: 60, document_type: "commercial_invoice", buyer_country: buyer, items: [{ description: desc, hs_code: hs, hs_status: hs ? "valid" : "missing", country_of_origin: null }], flags: [] };
}

describe("restricted", () => {
  it("flags lithium battery globally", async () => {
    const hits = await checkRestricted(doc("Lithium Power Bank 20000mAh", "United States"));
    expect(hits.some(h=>h.category==="batteries" && h.severity==="critical")).toBe(true);
  });
  it("flags cosmetics EU critical", async () => {
    const hits = await checkRestricted(doc("Face Serum Vitamin C", "France", "3304.99"));
    expect(hits.some(h=>h.category==="cosmetics" && h.severity==="critical")).toBe(true);
  });
  it("no battery flag for normal t-shirt", async () => {
    const hits = await checkRestricted(doc("Cotton T-shirt", "United Kingdom", "610910"));
    expect(hits.some(h=>h.category==="batteries")).toBe(false);
  });
});
