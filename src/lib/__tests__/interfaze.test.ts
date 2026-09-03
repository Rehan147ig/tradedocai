import { describe, it, expect, vi } from "vitest";
import { runInterfazeDecision } from "@/lib/interfaze";

describe("interfaze", () => {
  it("falls back to local when no API key", async () => {
    delete process.env.INTERFAZE_API_KEY;
    const res = await runInterfazeDecision({
      source: "shopify_order", ruleFlags: [], extractedPreview: { status: "needs_review", confidence: 50, document_type: "commercial_invoice", items: [{ description: "T-shirt", hs_code: null, hs_status: "missing" }], flags: [] } as never, userId: "u1",
    });
    expect(res.status).toBe("fallback");
    expect(res.auditTrail.workflowId).toBeTruthy();
    expect(res.data).toBeDefined();
  });
  it("handles Interfaze HTTP error gracefully", async () => {
    process.env.INTERFAZE_API_KEY = "test";
    process.env.INTERFAZE_BASE_URL = "https://invalid.local";
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 500, text: async () => "error" } as Response);
    const res = await runInterfazeDecision({
      source: "shopify_order", ruleFlags: [], extractedPreview: { status: "needs_review", confidence: 50, document_type: "commercial_invoice", items: [{ description: "T-shirt", hs_code: "610910", hs_status: "valid" }], flags: [] } as never, userId: "u1",
    });
    expect(res.status).toBe("fallback");
    spy.mockRestore();
    delete process.env.INTERFAZE_API_KEY;
  });
});
