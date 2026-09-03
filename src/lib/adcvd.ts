export interface ADCVDResult {
  risk_level: "active_order" | "check_required";
  description: string;
  action: string;
  cbp_link: string;
}

interface ADCVDWatchItem {
  hs_prefix: string;
  countries: string[];
  description: string;
  risk: string;
}

export const ADCVD_WATCH_LIST: ADCVDWatchItem[] = [
  { hs_prefix: "6109", countries: ["CN"], description: "Cotton knit shirts", risk: "check required" },
  { hs_prefix: "6203", countries: ["CN", "BD"], description: "Men's suits/trousers", risk: "check required" },
  { hs_prefix: "7208", countries: ["CN", "IN", "KR", "RU"], description: "Flat-rolled steel", risk: "AD/CVD order likely" },
  { hs_prefix: "7606", countries: ["CN"], description: "Aluminum sheets", risk: "AD/CVD order active" },
  { hs_prefix: "8541", countries: ["CN", "MY", "TH", "VN"], description: "Solar cells/panels", risk: "AD/CVD order active" },
  { hs_prefix: "9403", countries: ["CN", "VN"], description: "Wooden furniture", risk: "AD/CVD order active" },
  { hs_prefix: "0306", countries: ["CN", "IN", "EC", "TH"], description: "Shrimp/prawns", risk: "AD/CVD order active" },
  { hs_prefix: "4011", countries: ["CN"], description: "Pneumatic tires", risk: "AD/CVD order active" },
  { hs_prefix: "4802", countries: ["CN", "ID"], description: "Uncoated paper", risk: "check required" },
  { hs_prefix: "6907", countries: ["CN"], description: "Ceramic tiles", risk: "AD/CVD order active" },
];

const countryAliases: Record<string, string> = {
  china: "CN",
  cn: "CN",
  india: "IN",
  in: "IN",
  bangladesh: "BD",
  bd: "BD",
  korea: "KR",
  "south korea": "KR",
  russia: "RU",
  malaysia: "MY",
  thailand: "TH",
  vietnam: "VN",
  ecuador: "EC",
  indonesia: "ID",
};

export function checkADCVD(hsCode: string, countryOfOrigin: string): ADCVDResult | null {
  const normalizedHs = hsCode.replace(/[.\s]/g, "");
  const country = countryAliases[countryOfOrigin.trim().toLowerCase()] ?? countryOfOrigin.trim().toUpperCase();
  const match = ADCVD_WATCH_LIST.find((item) => normalizedHs.startsWith(item.hs_prefix) && item.countries.includes(country));
  if (!match) return null;

  const active = match.risk.toLowerCase().includes("active") || match.risk.toLowerCase().includes("likely");
  return {
    risk_level: active ? "active_order" : "check_required",
    description: match.description,
    action: `This product may have extra US antidumping or countervailing duties. Verify the order before shipping or pricing this item.`,
    cbp_link: "https://www.cbp.gov/trade/remedies/adcvd",
  };
}
