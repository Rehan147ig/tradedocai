import { ExtractedTradeDocument } from "@/lib/validators";
import { RuleFlag } from "@/lib/rule-engine";

const prompt = (text: string, ruleFlags: RuleFlag[] = []) => `You are a customs compliance expert.
Analyse this trade document and return only valid JSON. No markdown.

${ruleFlags.length ? `The rule engine has already identified these specific issues: ${JSON.stringify(ruleFlags)}.
Do not re-describe these issues. Focus your analysis on:
1. Whether the HS code matches the product description semantically
2. Whether the declared value appears consistent with the product type
3. Whether there are any trade-lane-specific requirements not covered by the rule flags
4. AD/CVD exposure for this product category
Generate fix suggestions in plain English. No compliance jargon.` : ""}

Document text:
${text.slice(0, 12000)}

Return this exact structure:
{
  "status": "ready_to_ship" | "needs_review" | "critical_issues",
  "confidence": 0-100,
  "document_type": "commercial_invoice" | "packing_list" | "certificate_of_origin" | "unknown",
  "invoice_number": string | null,
  "invoice_date": "YYYY-MM-DD" | null,
  "seller_name": string | null,
  "seller_address": string | null,
  "seller_country": string | null,
  "buyer_name": string | null,
  "buyer_address": string | null,
  "buyer_country": string | null,
  "eori_number": string | null,
  "eori_valid": boolean,
  "vat_number": string | null,
  "total_value": string | null,
  "currency": string | null,
  "incoterms": string | null,
  "items": [{"description": string, "quantity": string, "unit_price": string, "total_line_value": string, "hs_code": string | null, "hs_status": "valid" | "missing" | "invalid", "country_of_origin": string | null}],
  "flags": [{"severity": "error" | "warning" | "info", "field": string, "title": string, "fix": string}]
}`;

function fallbackExtraction(text: string): ExtractedTradeDocument {
  const invoiceNumber = text.match(/invoice\s*(number|no|#)?[:\s-]*([A-Z0-9-]+)/i)?.[2] ?? null;
  const eori = text.match(/\b[A-Z]{2}[A-Z0-9]{8,15}\b/)?.[0] ?? null;
  const hs = text.match(/\b\d{6}(?:[.\s]?\d{2})?(?:[.\s]?\d{2})?\b/)?.[0] ?? null;
  const total = text.match(/(?:total|amount due)[:\s£$€]*([0-9,.]+)/i)?.[1] ?? null;
  const currency = text.includes("£") || /\bGBP\b/i.test(text) ? "GBP" : text.includes("€") || /\bEUR\b/i.test(text) ? "EUR" : null;

  return {
    status: "needs_review",
    confidence: 58,
    document_type: /packing list/i.test(text) ? "packing_list" : "commercial_invoice",
    invoice_number: invoiceNumber,
    invoice_date: null,
    seller_name: null,
    seller_address: null,
    seller_country: /united kingdom| uk |gb/i.test(text) ? "United Kingdom" : null,
    buyer_name: null,
    buyer_address: null,
    buyer_country: /germany|france|netherlands|spain|italy/i.exec(text)?.[0] ?? null,
    eori_number: eori,
    eori_valid: Boolean(eori),
    vat_number: text.match(/\b[A-Z]{2}[0-9A-Z]{8,12}\b/)?.[0] ?? null,
    total_value: total,
    currency,
    incoterms: text.match(/\b(EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF)\b/i)?.[0]?.toUpperCase() ?? null,
    items: [
      {
        description: "Detected line item",
        quantity: null,
        unit_price: null,
        total_line_value: total,
        hs_code: hs,
        hs_status: hs ? "valid" : "missing",
        country_of_origin: null,
      },
    ],
    flags: [
      {
        severity: "info",
        field: "ai_provider",
        title: "Local fallback extraction used",
        fix: "Add NVIDIA_API_KEY to enable full AI extraction.",
      },
    ],
  };
}

export async function extractWithAi(text: string, ruleFlags: RuleFlag[] = []): Promise<ExtractedTradeDocument> {
  const provider = (process.env.AI_PROVIDER ?? "nvidia").toLowerCase();
  if (provider === "gemini") return extractWithGemini(text, ruleFlags);
  if (provider === "openai") return extractWithOpenAi(text, ruleFlags);
  return extractWithNvidia(text, ruleFlags);
}

async function extractWithNvidia(text: string, ruleFlags: RuleFlag[]): Promise<ExtractedTradeDocument> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return fallbackExtraction(text);

  const response = await fetch(`${process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1"}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.NVIDIA_MODEL ?? "meta/llama-3.3-70b-instruct",
      messages: [{ role: "user", content: prompt(text, ruleFlags) }],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    return {
      ...fallbackExtraction(text),
      flags: [
        {
          severity: "warning",
          field: "ai_provider",
          title: `NVIDIA API returned ${response.status}`,
          fix: "Check NVIDIA_API_KEY, rate limits, and selected model. The document was processed with local fallback extraction.",
        },
      ],
    };
  }

  const payload = await response.json();
  const raw = String(payload.choices?.[0]?.message?.content ?? "").replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(raw) as ExtractedTradeDocument;
  } catch {
    return {
      ...fallbackExtraction(text),
      flags: [
        {
          severity: "warning",
          field: "ai_response",
          title: "AI response was not valid JSON",
          fix: "Retry the document or switch model. The document was processed with local fallback extraction.",
        },
      ],
    };
  }
}

async function extractWithOpenAi(text: string, ruleFlags: RuleFlag[]): Promise<ExtractedTradeDocument> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackExtraction(text);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt(text, ruleFlags) }],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    return {
      ...fallbackExtraction(text),
      flags: [{
        severity: "warning",
        field: "ai_provider",
        title: `OpenAI API returned ${response.status}`,
        fix: "Check OPENAI_API_KEY and selected model. The document was processed with local fallback extraction.",
      }],
    };
  }

  const payload = await response.json();
  return parseAiJson(String(payload.choices?.[0]?.message?.content ?? ""), text, "OpenAI");
}

async function extractWithGemini(text: string, ruleFlags: RuleFlag[]): Promise<ExtractedTradeDocument> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackExtraction(text);

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt(text, ruleFlags) }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2000,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    return {
      ...fallbackExtraction(text),
      flags: [{
        severity: "warning",
        field: "ai_provider",
        title: `Gemini API returned ${response.status}`,
        fix: "Check GEMINI_API_KEY and selected model. The document was processed with local fallback extraction.",
      }],
    };
  }

  const payload = await response.json();
  const raw = payload.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
  return parseAiJson(raw, text, "Gemini");
}

function parseAiJson(rawContent: string, text: string, providerName: string): ExtractedTradeDocument {
  const raw = rawContent.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(raw) as ExtractedTradeDocument;
  } catch {
    return {
      ...fallbackExtraction(text),
      flags: [{
        severity: "warning",
        field: "ai_response",
        title: `${providerName} response was not valid JSON`,
        fix: "Retry the document or use a stricter model. The document was processed with local fallback extraction.",
      }],
    };
  }
}
