import { prisma } from "@/lib/db";
import { ExtractedTradeDocument } from "@/lib/validators";
import { RestrictedRule } from "@prisma/client";

export interface RestrictedHit {
  ruleId: string;
  category: string;
  severity: "critical" | "warning" | "info";
  title: string;
  body: string;
  hsCode?: string | null;
  sourceUrl?: string | null;
  lane?: string | null;
}

const FALLBACK_RULES: Array<Omit<RestrictedRule, "id" | "createdAt" | "updatedAt">> = [
  // Batteries / electronics — UN3480/3481
  { category: "batteries", hsPrefix: "8507", hsCode: null, countryFrom: null, countryTo: null, lane: "global", ruleType: "restricted", title: "Lithium battery — UN3480/3481 documentation required", body: "HS 8507 + electronics with lithium cells need UN38.3 test summary, MSDS, and carrier battery declaration. Declare watt-hours and UN number on invoice.", severity: "critical", sourceUrl: "https://www.iata.org/lithium-batteries" },
  { category: "batteries", hsPrefix: "8517", hsCode: null, countryFrom: null, countryTo: null, lane: "global", ruleType: "restricted", title: "Devices with lithium batteries — carrier restriction", body: "Phones, power banks, tablets (HS 8517/8471) are restricted by air. Add battery type (Li-ion/metal), Wh rating, UN3481 PI966-970 section.", severity: "warning", sourceUrl: "https://www.iata.org/lithium-batteries" },
  // Cosmetics / beauty
  { category: "cosmetics", hsPrefix: "3304", hsCode: null, countryFrom: null, countryTo: "EU", lane: "india-eu", ruleType: "regulation", title: "Cosmetics — EU CPSR / Responsible Person required", body: "HS 3304 beauty products to EU need Cosmetic Product Safety Report and EU Responsible Person on label. Ingredients list + CPNP notification.", severity: "critical", sourceUrl: "https://ec.europa.eu/cosmetics" },
  { category: "cosmetics", hsPrefix: "3304", hsCode: null, countryFrom: null, countryTo: "GB", lane: "global", ruleType: "regulation", title: "Cosmetics — UK SCPN notification", body: "UK requires SCPN notification via Office for Product Safety. Label must have UK RP address.", severity: "warning", sourceUrl: "https://www.gov.uk/guidance/cosmetics" },
  // Supplements / health
  { category: "supplements", hsPrefix: "2106", hsCode: null, countryFrom: null, countryTo: "US", lane: "india-us", ruleType: "regulation", title: "Supplements — FDA prior notice + facility registration", body: "HS 2106/3004 supplements to US need FDA facility registration and Prior Notice via ACE. Check DSHEA labeling.", severity: "critical", sourceUrl: "https://www.fda.gov/food/importing-food-products" },
  { category: "supplements", hsPrefix: "2106", hsCode: null, countryFrom: null, countryTo: "EU", lane: "global", ruleType: "regulation", title: "Supplements — EU novel food / health claim check", body: "Supplements may be novel food in EU (Reg 2015/2283). Verify authorized ingredients and health claims.", severity: "warning", sourceUrl: "https://food.ec.europa.eu/food-safety/novel-food_en" },
  // Apparel
  { category: "apparel", hsPrefix: "6109", hsCode: null, countryFrom: null, countryTo: null, lane: "global", ruleType: "info", title: "Apparel — textile composition required", body: "HS 61/62 apparel must list fiber composition (e.g. 100% cotton) and origin per piece for customs.", severity: "info", sourceUrl: null },
  // General restricted
  { category: "general", hsPrefix: null, hsCode: null, countryFrom: null, countryTo: "EU", lane: "global", ruleType: "threshold", title: "IOSS threshold €150 — duties/VAT split", body: "Consignments ≤€150 to EU can use IOSS for VAT; >€150 duties + VAT at import. Declare IOSS ID if used.", severity: "info", sourceUrl: "https://ec.europa.eu/taxation_customs/ioss_en" },
  { category: "general", hsPrefix: null, hsCode: null, countryFrom: null, countryTo: "GB", lane: "global", ruleType: "threshold", title: "UK £135 threshold — VAT at checkout vs import", body: "Goods ≤£135 to UK: VAT collected at checkout. >£135: VAT + duty at import. Match declared value to checkout VAT mode.", severity: "info", sourceUrl: "https://www.gov.uk/goods-sent-from-abroad" },
];

export async function getRestrictedRules(): Promise<RestrictedRule[]> {
  try {
    const count = await prisma.restrictedRule.count();
    if (count > 0) return prisma.restrictedRule.findMany();
  } catch {
    // table may not exist in dev without migrate — fallback
  }
  // Return fallback as typed
  return FALLBACK_RULES.map((r, i) => ({ ...r, id: `fallback-${i}`, createdAt: new Date(), updatedAt: new Date() } as RestrictedRule));
}

export async function checkRestricted(data: ExtractedTradeDocument, lane?: string): Promise<RestrictedHit[]> {
  const rules = await getRestrictedRules();
  const hits: RestrictedHit[] = [];
  const buyer = (data.buyer_country ?? "").toLowerCase();
  const destIsEU = ["germany", "france", "netherlands", "spain", "italy", "eu", "european union"].some((k) => buyer.includes(k));
  const destIsGB = buyer.includes("united kingdom") || buyer.includes(" uk") || buyer.includes("gb");
  const destIsUS = buyer.includes("united states") || buyer.includes("usa");

  for (const item of data.items) {
    const hs = (item.hs_code ?? "").replace(/[.\s]/g, "");
    for (const rule of rules) {
      if (rule.hsPrefix && hs && !hs.startsWith(rule.hsPrefix)) continue;
      if (rule.lane && rule.lane !== "global" && lane && rule.lane !== lane) continue;
      // countryTo filter
      if (rule.countryTo === "EU" && !destIsEU) continue;
      if (rule.countryTo === "GB" && !destIsGB) continue;
      if (rule.countryTo === "US" && !destIsUS) continue;
      // avoid duplicate generic threshold per item — only once
      const isThreshold = rule.ruleType === "threshold";
      if (isThreshold && hits.some((h) => h.ruleId === rule.id)) continue;

      // If rule is hs-specific and no HS, still warn for category match via description
      const desc = (item.description ?? "").toLowerCase();
      const isBatteryDesc = /battery|lithium|power bank|powerbank/.test(desc);
      const isCosmeticDesc = /cream|lotion|serum|cosmetic|makeup|lipstick/.test(desc);
      const isSupplementDesc = /supplement|vitamin|protein|herbal|capsule|gummy/.test(desc);
      if (!hs && rule.category === "batteries" && !isBatteryDesc) continue;
      if (!hs && rule.category === "cosmetics" && !isCosmeticDesc) continue;
      if (!hs && rule.category === "supplements" && !isSupplementDesc) continue;

      // For threshold rules, only emit once per document
      hits.push({
        ruleId: rule.id,
        category: rule.category,
        severity: rule.severity as RestrictedHit["severity"],
        title: rule.title,
        body: rule.body,
        hsCode: item.hs_code,
        sourceUrl: rule.sourceUrl,
        lane: rule.lane,
      });
      if (isThreshold) break;
    }
    if (hits.length > 12) break;
  }

  // Dedupe by title
  const seen = new Set<string>();
  return hits.filter((h) => (seen.has(h.title) ? false : (seen.add(h.title), true)));
}

export function restrictedHitsToFlags(hits: RestrictedHit[]) {
  return hits.map((h) => ({
    severity: h.severity === "critical" ? "critical" as const : h.severity === "warning" ? "warning" as const : "info" as const,
    field: `restricted_${h.category}`,
    title: h.title,
    fix: h.body + (h.sourceUrl ? ` See: ${h.sourceUrl}` : ""),
    source: "restricted" as const,
    link: h.sourceUrl ?? undefined,
  }));
}

export const SEED_RULES = FALLBACK_RULES;
