type Flag = {
  severity: "critical" | "error" | "warning" | "info";
  field: string;
  title: string;
  fix: string;
  source?: string;
  link?: string;
};

export type ExtractedTradeDocument = {
  status: "ready_to_ship" | "needs_review" | "critical_issues";
  confidence: number;
  document_type: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  seller_name?: string | null;
  seller_address?: string | null;
  seller_country?: string | null;
  buyer_name?: string | null;
  buyer_address?: string | null;
  buyer_country?: string | null;
  eori_number?: string | null;
  eori_valid?: boolean;
  vat_number?: string | null;
  total_value?: string | null;
  currency?: string | null;
  incoterms?: string | null;
  port_of_loading?: string | null;
  port_of_discharge?: string | null;
  manufacturer_name?: string | null;
  payment_terms?: string | null;
  marks_and_numbers?: string | null;
  rule_score?: number;
  rule_status?: "ready" | "review" | "high-risk";
  passing_checks?: string[];
  items: Array<{
    description: string;
    quantity?: string | null;
    unit_price?: string | null;
    total_line_value?: string | null;
    hs_code?: string | null;
    hs_status?: "valid" | "missing" | "invalid";
    country_of_origin?: string | null;
    unit_of_measure?: string | null;
    net_weight?: string | null;
    gross_weight?: string | null;
  }>;
  flags: Flag[];
};

export function validateTradeDocument(data: ExtractedTradeDocument): ExtractedTradeDocument {
  const flags = [...(data.flags ?? [])];
  const eori = data.eori_number?.trim();

  if (!eori) {
    flags.push({
      severity: "error",
      field: "eori_number",
      title: "EORI number missing",
      fix: "Add the exporter EORI number. UK exporters usually use GB followed by 12 digits.",
    });
  } else if (!/^([A-Z]{2})[A-Z0-9]{8,15}$/.test(eori.replace(/\s/g, ""))) {
    flags.push({
      severity: "error",
      field: "eori_number",
      title: `EORI format looks invalid: ${eori}`,
      fix: "Check the EORI country prefix and number before shipping.",
    });
    data.eori_valid = false;
  } else {
    data.eori_valid = true;
  }

  data.items = data.items?.length ? data.items : [];
  data.items.forEach((item, index) => {
    const hs = item.hs_code?.replace(/[.\s]/g, "");
    if (!hs) {
      item.hs_status = "missing";
      flags.push({
        severity: "error",
        field: `items[${index}].hs_code`,
        title: `Missing HS code: ${item.description || `Item ${index + 1}`}`,
        fix: "Add a 6 to 10 digit HS or commodity code for customs clearance.",
      });
    } else if (!/^\d{6,10}$/.test(hs)) {
      item.hs_status = "invalid";
      flags.push({
        severity: "error",
        field: `items[${index}].hs_code`,
        title: `Invalid HS code format: ${item.hs_code}`,
        fix: "Use digits only, usually 6 to 10 digits depending on the destination.",
      });
    } else {
      item.hs_status = "valid";
    }

    if (!item.country_of_origin) {
      flags.push({
        severity: "warning",
        field: `items[${index}].country_of_origin`,
        title: `Missing country of origin: ${item.description || `Item ${index + 1}`}`,
        fix: "Add country of origin so customs can assess tariff treatment.",
      });
    }
  });

  const buyerCountry = data.buyer_country?.toLowerCase() ?? "";
  if (buyerCountry && !["united kingdom", "uk", "gb", "great britain"].includes(buyerCountry)) {
    if (data.buyer_name && !data.vat_number) {
      flags.push({
        severity: "warning",
        field: "vat_number",
        title: "Buyer VAT number missing",
        fix: "For B2B shipments, add the buyer VAT ID when available.",
      });
    }
  }

  if (data.invoice_date) {
    const invoiceTime = Date.parse(data.invoice_date);
    if (!Number.isNaN(invoiceTime)) {
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      if (invoiceTime < ninetyDaysAgo) {
        flags.push({
          severity: "warning",
          field: "invoice_date",
          title: "Invoice is more than 90 days old",
          fix: "Use a fresh invoice if your courier or customs broker requires recent paperwork.",
        });
      }
    }
  }

  const severities = flags.map((flag) => flag.severity);
  data.status = severities.includes("critical") || severities.includes("error")
    ? "critical_issues"
    : severities.includes("warning")
      ? "needs_review"
      : "ready_to_ship";
  data.flags = flags;
  return data;
}
