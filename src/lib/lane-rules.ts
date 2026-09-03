import { ExtractedTradeDocument } from "@/lib/validators";

export type TradeLane = "india-us" | "india-uk" | "india-eu" | "uk-eu" | "eu-uk" | "global";

export const TRADE_LANES: Record<TradeLane, { label: string; dutyRate: number; taxRate: number; requiredIds: string[]; notes: string[] }> = {
  "india-us": {
    label: "India to US",
    dutyRate: 0.07,
    taxRate: 0,
    requiredIds: ["IEC/GST recommended", "HTS/HS code"],
    notes: ["Use strong product descriptions and verify HTS classification for US entry."],
  },
  "india-uk": {
    label: "India to UK",
    dutyRate: 0.08,
    taxRate: 0.2,
    requiredIds: ["IEC/GST recommended", "UK commodity code", "Importer VAT/EORI when B2B"],
    notes: ["UK VAT is commonly charged on imported goods. Confirm DDP/DDU expectations before dispatch."],
  },
  "india-eu": {
    label: "India to EU",
    dutyRate: 0.09,
    taxRate: 0.21,
    requiredIds: ["IEC/GST recommended", "EU commodity code", "Buyer VAT/IOSS when relevant"],
    notes: ["EU buyers may refuse delivery when duties and VAT are unexpected."],
  },
  "uk-eu": {
    label: "UK to EU",
    dutyRate: 0.06,
    taxRate: 0.21,
    requiredIds: ["GB EORI", "EU buyer VAT/EORI when B2B", "Country of origin"],
    notes: ["Post-Brexit shipments need origin data per line item."],
  },
  "eu-uk": {
    label: "EU to UK",
    dutyRate: 0.06,
    taxRate: 0.2,
    requiredIds: ["EU EORI", "UK importer VAT/EORI when B2B", "Country of origin"],
    notes: ["Check UK commodity code format and importer responsibilities."],
  },
  global: {
    label: "Global",
    dutyRate: 0.08,
    taxRate: 0.15,
    requiredIds: ["HS code", "Country of origin", "Buyer and seller details"],
    notes: ["Use this as a rough preflight lane until the exact route is selected."],
  },
};

export function inferLane(data: ExtractedTradeDocument): TradeLane {
  const seller = (data.seller_country ?? "").toLowerCase();
  const buyer = (data.buyer_country ?? "").toLowerCase();
  if (seller.includes("india") && buyer.includes("united states")) return "india-us";
  if (seller.includes("india") && buyer.includes("united kingdom")) return "india-uk";
  if (seller.includes("india")) return "india-eu";
  if ((seller.includes("uk") || seller.includes("kingdom")) && !buyer.includes("kingdom")) return "uk-eu";
  if (!seller.includes("kingdom") && buyer.includes("kingdom")) return "eu-uk";
  return "global";
}

export function applyLaneRules(data: ExtractedTradeDocument, lane: TradeLane = inferLane(data)) {
  const rule = TRADE_LANES[lane];
  const flags = [...(data.flags ?? [])];

  if (!data.incoterms) {
    flags.push({
      severity: "warning",
      field: "incoterms",
      title: "Incoterms missing",
      fix: `Add incoterms for ${rule.label}, especially if duties are paid by seller or buyer.`,
    });
  }

  if (!data.currency) {
    flags.push({
      severity: "warning",
      field: "currency",
      title: "Currency missing",
      fix: "Add invoice currency so duties and VAT can be estimated.",
    });
  }

  flags.push({
    severity: "info",
    field: "trade_lane",
    title: `Lane rules applied: ${rule.label}`,
    fix: `Required checks: ${rule.requiredIds.join(", ")}.`,
  });

  data.flags = flags;
  return data;
}

export function estimateLandedCost(data: ExtractedTradeDocument, lane: TradeLane = inferLane(data)) {
  const rule = TRADE_LANES[lane];
  const invoiceValue = Number(String(data.total_value ?? "").replace(/[^0-9.]/g, "")) || sumLineValues(data);
  const duty = invoiceValue * rule.dutyRate;
  const taxBase = invoiceValue + duty;
  const tax = taxBase * rule.taxRate;
  const total = invoiceValue + duty + tax;

  return {
    lane,
    laneLabel: rule.label,
    currency: data.currency ?? "GBP",
    invoiceValue: round(invoiceValue),
    estimatedDuty: round(duty),
    estimatedTax: round(tax),
    estimatedLandedCost: round(total),
    assumptions: [
      `Duty estimated at ${(rule.dutyRate * 100).toFixed(1)}% for preflight only.`,
      `Tax/VAT estimated at ${(rule.taxRate * 100).toFixed(1)}% where applicable.`,
      ...rule.notes,
    ],
  };
}

function sumLineValues(data: ExtractedTradeDocument) {
  return data.items.reduce((sum, item) => {
    const line = Number(String(item.total_line_value ?? "").replace(/[^0-9.]/g, ""));
    return sum + (Number.isFinite(line) ? line : 0);
  }, 0);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
