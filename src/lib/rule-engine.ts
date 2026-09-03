import { checkADCVD } from "@/lib/adcvd";
import { ExtractedTradeDocument } from "@/lib/validators";

export interface RuleCheckResult {
  passed: boolean;
  flags: RuleFlag[];
  score: number;
  status: "ready" | "review" | "high-risk";
  data: ExtractedTradeDocument;
  passingChecks: string[];
}

export interface RuleFlag {
  field: string;
  severity: "critical" | "warning" | "info";
  message: string;
  fix: string;
  source?: "rule_engine" | "adcvd";
  link?: string;
}

const vagueTerms = new Set(["goods", "merchandise", "samples", "items", "parts", "products", "miscellaneous", "various", "gift", "personal effects"]);
const incoterms = /\b(EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF)\b/i;

export function extractRuleFieldsFromText(text: string): ExtractedTradeDocument {
  const hs = text.match(/\b\d{4}(?:[.\s]?\d{2}){0,3}\b/)?.[0] ?? null;
  const total = text.match(/(?:total|invoice value|amount due)[:\s£$€]*([0-9,.]+)/i)?.[1] ?? null;
  const currency = /\bGBP\b|£/i.test(text) ? "GBP" : /\bUSD\b|\$/i.test(text) ? "USD" : /\bEUR\b|€/i.test(text) ? "EUR" : null;
  const description = text.match(/(?:description|product)[:\s-]+(.{8,90})/i)?.[1]?.trim() ?? "Detected product";
  const origin = text.match(/(?:country of origin|origin)[:\s-]+([A-Za-z ]{2,40})/i)?.[1]?.trim() ?? null;

  return {
    status: "needs_review",
    confidence: 45,
    document_type: /packing list/i.test(text) ? "packing_list" : /bill of lading|bol/i.test(text) ? "bill_of_lading" : "commercial_invoice",
    invoice_number: text.match(/invoice\s*(number|no|#)?[:\s-]*([A-Z0-9-]+)/i)?.[2] ?? null,
    invoice_date: text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1] ?? null,
    seller_name: text.match(/(?:seller|shipper|exporter)[:\s-]+(.+)/i)?.[1]?.trim() ?? null,
    seller_address: null,
    seller_country: /india/i.test(text) ? "India" : /china/i.test(text) ? "China" : /united kingdom| uk |gb/i.test(text) ? "United Kingdom" : null,
    buyer_name: text.match(/(?:buyer|consignee|importer)[:\s-]+(.+)/i)?.[1]?.trim() ?? null,
    buyer_address: null,
    buyer_country: /united states| usa | us /i.test(text) ? "United States" : /united kingdom| uk |gb/i.test(text) ? "United Kingdom" : null,
    eori_number: text.match(/\b[A-Z]{2}[A-Z0-9]{8,15}\b/)?.[0] ?? null,
    eori_valid: undefined,
    vat_number: text.match(/\b[A-Z]{2}[0-9A-Z]{8,12}\b/)?.[0] ?? null,
    total_value: total,
    currency,
    incoterms: text.match(incoterms)?.[0]?.toUpperCase() ?? null,
    items: [{
      description,
      quantity: text.match(/(?:quantity|qty)[:\s-]*([0-9,.]+)/i)?.[1] ?? null,
      unit_price: text.match(/(?:unit price)[:\s£$€-]*([0-9,.]+)/i)?.[1] ?? null,
      total_line_value: total,
      hs_code: hs,
      hs_status: hs ? "valid" : "missing",
      country_of_origin: origin,
      unit_of_measure: text.match(/\b(pcs|pieces|kg|cartons|sets|units)\b/i)?.[0] ?? null,
      net_weight: text.match(/net weight[:\s-]*([0-9,.]+)/i)?.[1] ?? null,
      gross_weight: text.match(/gross weight[:\s-]*([0-9,.]+)/i)?.[1] ?? null,
    }],
    port_of_loading: text.match(/port of loading[:\s-]+(.+)/i)?.[1]?.trim() ?? null,
    port_of_discharge: text.match(/port of discharge[:\s-]+(.+)/i)?.[1]?.trim() ?? null,
    flags: [],
  };
}

export function runRuleEngine(data: ExtractedTradeDocument): RuleCheckResult {
  const flags: RuleFlag[] = [];
  const passingChecks: string[] = [];
  const firstItem = data.items[0];
  const description = firstItem?.description?.trim() ?? "";
  const hsCode = firstItem?.hs_code?.trim() ?? "";
  const origin = firstItem?.country_of_origin?.trim() ?? "";
  const invoiceValue = Number(String(data.total_value ?? firstItem?.total_line_value ?? "").replace(/[^0-9.]/g, ""));

  critical(!data.seller_name?.trim(), "seller_name", "Seller name is missing.", "Add the exporter or seller legal name.");
  critical(!data.buyer_name?.trim(), "buyer_name", "Buyer or consignee name is missing.", "Add the buyer or consignee legal name.");
  critical(!origin, "country_of_origin", "Country of origin is missing.", "Add country of origin for every product line.");
  critical(!hsCode || !isValidHs(hsCode), "hs_code", "HS code is missing or invalid.", "Use a 6, 8, or 10 digit HS code, or a code like 8518.30.95.");
  critical(!invoiceValue || invoiceValue <= 0, "invoice_value", "Invoice value is missing or zero.", "Add a positive invoice value for customs.");
  critical(!data.currency, "currency", "Currency is missing.", "Add the invoice currency such as USD, GBP, or EUR.");
  critical(vagueTerms.has(description.toLowerCase()), "product_description", "Product description is too vague.", "Describe the product material, use, and type.");
  critical(!data.incoterms, "incoterms", "Incoterms are missing.", "Add EXW, FOB, CIF, DAP, DDP, or the correct shipping term.");

  warning(!data.invoice_number, "invoice_number", "Invoice number is missing.", "Add a unique invoice number.");
  warning(!data.invoice_date || isOlderThanDays(data.invoice_date, 60), "invoice_date", "Invoice date is missing or older than 60 days.", "Use a recent invoice date.");
  warning(!firstItem?.quantity || Number(firstItem.quantity) <= 0, "quantity", "Quantity is missing or zero.", "Add quantity for each product line.");
  warning(!firstItem?.unit_of_measure, "unit_of_measure", "Unit of measure is missing.", "Add pcs, kg, cartons, sets, or another clear unit.");
  warning(!firstItem?.net_weight || !firstItem?.gross_weight, "weight", "Net or gross weight is missing.", "Add net and gross weight.");
  warning(!data.port_of_loading, "port_of_loading", "Port of loading is missing.", "Add the port where the shipment leaves.");
  warning(!data.port_of_discharge, "port_of_discharge", "Port of discharge is missing.", "Add the destination port.");
  warning(!data.vat_number && !data.eori_number, "buyer_tax_id", "Buyer tax ID is missing.", "Add EORI, EIN, VAT, or importer tax ID where available.");
  warning(/^\d{4}$/.test(hsCode.replace(/[.\s]/g, "")), "hs_code", "HS code is only 4 digits.", "Use at least 6 digits for customs pre-checks.");
  warning(description.split(/\s+/).filter(Boolean).length < 10, "product_description", "Product description may be too short.", "Use at least 10 words describing material, use, and product type.");

  info(!data.manufacturer_name, "manufacturer_name", "Manufacturer name is not provided.", "Add manufacturer name when available.");
  info(!data.payment_terms, "payment_terms", "Payment terms are not specified.", "Add payment terms when available.");
  info(!data.marks_and_numbers, "marks_and_numbers", "Package marks and numbers are not provided.", "Add package marks and numbers if used.");

  if (hsCode && origin) {
    const adcvd = checkADCVD(hsCode, origin);
    if (adcvd) {
      flags.push({
        field: "adcvd",
        severity: adcvd.risk_level === "active_order" ? "critical" : "warning",
        message: `This product (HS ${hsCode}) from ${origin} may be subject to antidumping or countervailing duties.`,
        fix: "Additional duties can be very high. Verify at cbp.gov before shipping.",
        source: "adcvd",
        link: adcvd.cbp_link,
      });
    }
  }

  const score = Math.max(0, 100 - flags.reduce((sum, flag) => sum + (flag.severity === "critical" ? 25 : flag.severity === "warning" ? 10 : 3), 0));
  const criticalCount = flags.filter((flag) => flag.severity === "critical").length;
  const status = score >= 80 && criticalCount === 0 ? "ready" : score < 50 || criticalCount >= 3 ? "high-risk" : "review";

  return { passed: status === "ready", flags, score, status, data, passingChecks };

  function critical(condition: boolean, field: string, message: string, fix: string) {
    condition ? flags.push({ field, severity: "critical", message, fix, source: "rule_engine" }) : passingChecks.push(field);
  }

  function warning(condition: boolean, field: string, message: string, fix: string) {
    condition ? flags.push({ field, severity: "warning", message, fix, source: "rule_engine" }) : passingChecks.push(field);
  }

  function info(condition: boolean, field: string, message: string, fix: string) {
    if (condition) flags.push({ field, severity: "info", message, fix, source: "rule_engine" });
  }
}

export function ruleFlagsToDocumentFlags(flags: RuleFlag[]) {
  return flags.map((flag) => ({
    severity: flag.severity,
    field: flag.field,
    title: flag.message,
    fix: flag.fix,
    source: flag.source,
    link: flag.link,
  }));
}

function isValidHs(hsCode: string) {
  const normalized = hsCode.replace(/[.\s]/g, "");
  return /^\d{6}$|^\d{8}$|^\d{10}$/.test(normalized) || /^\d{4}\.\d{2}\.\d{2}$/.test(hsCode);
}

function isOlderThanDays(date: string, days: number) {
  const parsed = Date.parse(date);
  return Number.isNaN(parsed) || parsed < Date.now() - days * 24 * 60 * 60 * 1000;
}
