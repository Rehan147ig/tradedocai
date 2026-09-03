export type TourId = "shopify" | "decision" | "dashboard" | "check";

export const TOUR_STEPS: Record<TourId, Array<{ element: string; popover: { title: string; description: string; side?: "top" | "bottom" | "left" | "right" } }>> = {
  shopify: [
    { element: "#tour-shopify-hero", popover: { title: "Welcome to ClearShip AI", description: "Shopify orders → HS, duties, batteries checked automatically. This tour is 60 seconds. You can skip anytime.", side: "bottom" } },
    { element: "#tour-connect", popover: { title: "Step 1 — Connect your store", description: "Paste your-store.myshopify.com and click Connect. Orders sync via webhook — no code. Or skip and try a demo below.", side: "bottom" } },
    { element: "#tour-demo", popover: { title: "Step 2 — Try a demo in 5 seconds", description: "No store needed: click Battery or Cosmetics → Run check. We run the same Interfaze.AI checks: HS, origin, VAT, restricted.", side: "top" } },
    { element: "#tour-orders", popover: { title: "Step 3 — Review & print", description: "Orders appear here with plain English: Ready to ship / Needs check / Fix needed. Click Review & print for 1-click docs.", side: "top" } },
    { element: "#tour-approve", popover: { title: "Team approve in 1 click", description: "Teammate clicks Approve — broker link if needed. No email chains. See it in the table's Approve column.", side: "left" } },
  ],
  decision: [
    { element: "#tour-stepper", popover: { title: "Where is this order?", description: "Order detected → AI checked → Team approval → Broker → Ready to ship. Green = done, blue = your turn.", side: "bottom" } },
    { element: "#tour-print", popover: { title: "1-click docs", description: "Invoice PDF, Packing List PDF, and Carrier JSON (Easyship/DHL) — no fields to fill. Download and upload to carrier.", side: "bottom" } },
    { element: "#tour-attention", popover: { title: "What needs your attention", description: "Plain English, not codes. Red = fix before ship, yellow = check. Each has a Fix line.", side: "top" } },
    { element: "#tour-broker", popover: { title: "Need a broker? 1 field", description: "Enter broker@email.com → Create link. Broker opens without login — approve/reject, you see status live.", side: "top" } },
    { element: "#tour-hs", popover: { title: "HS guesses, explained", description: "From your SKU memory or Interfaze AI. Check me = human must verify. Great for audit vault (7 years).", side: "top" } },
  ],
  dashboard: [
    { element: "#tour-dashboard-cta", popover: { title: "Easiest path: Shopify", description: "Connect Shopify for auto-checks. Or use classic PDF Check a shipment below.", side: "bottom" } },
    { element: "#tour-metrics", popover: { title: "At a glance", description: "Ready / Needs review / Critical counts. Alerts tell you about tariff changes.", side: "top" } },
  ],
  check: [
    { element: "#tour-check-hero", popover: { title: "Check any invoice PDF", description: "For non-Shopify: pick lane, drop PDF, get HS + flags + landed cost. Classic TradeDocAI.", side: "bottom" } },
    { element: "#tour-check-upload", popover: { title: "Drop it here", description: "We store with timestamp, size, retention — and keep SKU memory for next time.", side: "top" } },
  ],
};

export function shouldAutoShow(tourId: TourId): boolean {
  if (typeof window === "undefined") return false;
  return !localStorage.getItem(`tour_seen_${tourId}`);
}
export function markSeen(tourId: TourId) {
  localStorage.setItem(`tour_seen_${tourId}`, "1");
}
