import { describe, it, expect } from "vitest";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

const doc = { invoice_number: "INV-1", invoice_date: "2024-01-01", seller_name: "Seller", buyer_name: "Buyer", buyer_country: "UK", total_value: "100", currency: "GBP", incoterms: "DAP", confidence: 80, status: "needs_review", items: [{ description: "Cotton T-shirt", hs_code: "610910", hs_status: "valid", quantity: "2", unit_price: "50", total_line_value: "100", country_of_origin: "India" }], flags: [] } as never;

describe("invoice-pdf", () => {
  it("generates commercial invoice pdf bytes", async () => {
    const pdf = await generateInvoicePdf(doc, { type: "commercial_invoice", laneLabel: "India to UK" });
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf[0]).toBe(37); // %PDF
  });
  it("generates packing list pdf", async () => {
    const pdf = await generateInvoicePdf(doc, { type: "packing_list" });
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
