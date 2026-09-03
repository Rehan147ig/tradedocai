import { estimateLandedCost, inferLane } from "@/lib/lane-rules";
import { ExtractedTradeDocument } from "@/lib/validators";

export function generateBrokerSummary(data: ExtractedTradeDocument) {
  const lane = inferLane(data);
  const landed = estimateLandedCost(data, lane);
  const errors = data.flags.filter((flag) => flag.severity === "error");
  const warnings = data.flags.filter((flag) => flag.severity === "warning");

  return [
    "TRADEDOC AI BROKER SUMMARY",
    "",
    `Lane: ${landed.laneLabel}`,
    `Invoice: ${data.invoice_number ?? "Not found"}`,
    `Seller: ${data.seller_name ?? "Not found"}`,
    `Buyer: ${data.buyer_name ?? "Not found"}`,
    `Value: ${landed.currency} ${landed.invoiceValue}`,
    `Estimated landed cost: ${landed.currency} ${landed.estimatedLandedCost}`,
    "",
    `Critical issues: ${errors.length}`,
    ...errors.map((flag) => `- ${flag.title}: ${flag.fix}`),
    "",
    `Warnings: ${warnings.length}`,
    ...warnings.map((flag) => `- ${flag.title}: ${flag.fix}`),
    "",
    "Line items:",
    ...data.items.map((item, index) => `${index + 1}. ${item.description} | HS: ${item.hs_code ?? "missing"} | Origin: ${item.country_of_origin ?? "missing"}`),
  ].join("\n");
}

export function generateCorrectionChecklist(data: ExtractedTradeDocument) {
  const actionable = data.flags.filter((flag) => flag.severity !== "info");
  return {
    title: "Customs correction checklist",
    status: data.status,
    fixes: actionable.map((flag) => ({
      field: flag.field,
      problem: flag.title,
      action: flag.fix,
    })),
    nextStep: actionable.length ? "Fix these fields before handing the document to the courier or broker." : "No blocking issues found. Still verify final HS classification before filing.",
  };
}

export function generateCustomerDutyNotice(data: ExtractedTradeDocument) {
  const landed = estimateLandedCost(data);
  return `International order notice: this shipment may be subject to customs duties, import VAT/tax, and local clearance fees in ${data.buyer_country ?? "the destination country"}. Estimated preflight landed cost is ${landed.currency} ${landed.estimatedLandedCost}, based on available invoice data. Final charges are decided by customs and the carrier.`;
}
