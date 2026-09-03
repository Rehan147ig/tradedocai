import { ExtractedTradeDocument } from "@/lib/validators";

export interface ConsistencyCheck {
  field: string;
  doc1Value: string;
  doc2Value: string;
  doc1Type: "invoice" | "packing_list" | "bol";
  doc2Type: "invoice" | "packing_list" | "bol";
  status: "match" | "mismatch" | "missing_in_one";
  severity: "critical" | "warning";
}

export type CrossCheckDocType = "invoice" | "packing_list" | "bol";

export function runConsistencyChecks(documents: Partial<Record<CrossCheckDocType, ExtractedTradeDocument>>) {
  const checks: ConsistencyCheck[] = [];
  const pairs: Array<[CrossCheckDocType, CrossCheckDocType]> = [["invoice", "packing_list"], ["invoice", "bol"], ["packing_list", "bol"]];

  for (const [left, right] of pairs) {
    const doc1 = documents[left];
    const doc2 = documents[right];
    if (!doc1 || !doc2) continue;

    compareExact(checks, "consignee_name", value(doc1.buyer_name), value(doc2.buyer_name), left, right, "critical");
    compareExact(checks, "shipper_name", value(doc1.seller_name), value(doc2.seller_name), left, right, "critical");
    compareExact(checks, "total_packages", first(doc1, "quantity"), first(doc2, "quantity"), left, right, "critical");
    compareTolerance(checks, "gross_weight", first(doc1, "gross_weight"), first(doc2, "gross_weight"), left, right, "warning");
    compareTolerance(checks, "net_weight", first(doc1, "net_weight"), first(doc2, "net_weight"), left, right, "warning");
    compareSemantic(checks, "product_description", first(doc1, "description"), first(doc2, "description"), left, right, "warning");
    compareExact(checks, "hs_code", first(doc1, "hs_code"), first(doc2, "hs_code"), left, right, "critical");
    compareValueFloor(checks, "invoice_value", value(doc1.total_value), value(doc2.total_value), left, right, "critical");
    compareExact(checks, "country_of_origin", first(doc1, "country_of_origin"), first(doc2, "country_of_origin"), left, right, "critical");
    compareExact(checks, "port_of_loading", value(doc1.port_of_loading), value(doc2.port_of_loading), left, right, "warning");
    compareExact(checks, "port_of_discharge", value(doc1.port_of_discharge), value(doc2.port_of_discharge), left, right, "warning");
  }

  return checks;
}

function compareExact(checks: ConsistencyCheck[], field: string, doc1Value: string, doc2Value: string, doc1Type: CrossCheckDocType, doc2Type: CrossCheckDocType, severity: "critical" | "warning") {
  const status = !doc1Value || !doc2Value ? "missing_in_one" : normalize(doc1Value) === normalize(doc2Value) ? "match" : "mismatch";
  checks.push({ field, doc1Value, doc2Value, doc1Type, doc2Type, status, severity });
}

function compareTolerance(checks: ConsistencyCheck[], field: string, doc1Value: string, doc2Value: string, doc1Type: CrossCheckDocType, doc2Type: CrossCheckDocType, severity: "critical" | "warning") {
  const left = number(doc1Value);
  const right = number(doc2Value);
  const status = left === null || right === null ? "missing_in_one" : Math.abs(left - right) / Math.max(left, right, 1) <= 0.05 ? "match" : "mismatch";
  checks.push({ field, doc1Value, doc2Value, doc1Type, doc2Type, status, severity });
}

function compareSemantic(checks: ConsistencyCheck[], field: string, doc1Value: string, doc2Value: string, doc1Type: CrossCheckDocType, doc2Type: CrossCheckDocType, severity: "critical" | "warning") {
  const left = new Set(normalize(doc1Value).split(" ").filter((word) => word.length > 4));
  const right = new Set(normalize(doc2Value).split(" ").filter((word) => word.length > 4));
  const overlap = [...left].filter((word) => right.has(word)).length;
  const status = !doc1Value || !doc2Value ? "missing_in_one" : overlap > 0 ? "match" : "mismatch";
  checks.push({ field, doc1Value, doc2Value, doc1Type, doc2Type, status, severity });
}

function compareValueFloor(checks: ConsistencyCheck[], field: string, doc1Value: string, doc2Value: string, doc1Type: CrossCheckDocType, doc2Type: CrossCheckDocType, severity: "critical" | "warning") {
  const left = number(doc1Value);
  const right = number(doc2Value);
  const status = left === null || right === null ? "missing_in_one" : right + 0.01 >= left ? "match" : "mismatch";
  checks.push({ field, doc1Value, doc2Value, doc1Type, doc2Type, status, severity });
}

function first(data: ExtractedTradeDocument, key: keyof ExtractedTradeDocument["items"][number]) {
  return value(data.items[0]?.[key]);
}

function value(input: unknown) {
  return input === null || input === undefined ? "" : String(input).trim();
}

function normalize(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function number(input: string) {
  const parsed = Number(input.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
