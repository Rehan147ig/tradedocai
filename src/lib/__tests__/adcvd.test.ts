import { describe, it, expect } from "vitest";
import { checkADCVD } from "@/lib/adcvd";

describe("adcvd", () => {
  it("detects active order for steel India", () => {
    const r = checkADCVD("7208.10", "India");
    expect(r?.risk_level).toBe("active_order");
  });
  it("returns null for safe HS", () => {
    expect(checkADCVD("999999", "India")).toBeNull();
  });
  it("handles CN alias", () => {
    expect(checkADCVD("7606.11", "China")).not.toBeNull();
    expect(checkADCVD("7606.11", "CN")).not.toBeNull();
  });
});
