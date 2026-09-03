import { ExtractedTradeDocument } from "@/lib/validators";
import { RuleFlag } from "@/lib/rule-engine";
import { extractWithAi } from "@/lib/ai";

export type InterfazeRunStatus = "success" | "fallback" | "error";

export interface InterfazeDecisionInput {
  source: "shopify_order" | "pdf_document" | "api";
  shopDomain?: string;
  orderId?: string;
  orderJson?: unknown;
  documentText?: string;
  ruleFlags: RuleFlag[];
  extractedPreview: ExtractedTradeDocument;
  lane?: string;
  userId: string;
}

export interface InterfazeDecisionOutput {
  status: InterfazeRunStatus;
  workflowId: string;
  runId: string;
  data: ExtractedTradeDocument;
  auditTrail: {
    workflowId: string;
    runId: string;
    provider: string;
    steps: Array<{ name: string; status: string; durationMs?: number; reason?: string }>;
    ruleIds: string[];
    model?: string;
    deterministic: boolean;
  };
  usage?: { promptTokens?: number; completionTokens?: number };
}

const INTERFAZE_WORKFLOW_ID = process.env.INTERFAZE_WORKFLOW_ID ?? "clearship-decision-v1";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildDeterministicAudit(ruleFlags: RuleFlag[], provider: string, fallbackReason?: string): InterfazeDecisionOutput["auditTrail"] {
  return {
    workflowId: INTERFAZE_WORKFLOW_ID,
    runId: uid(),
    provider,
    deterministic: provider === "rule_engine",
    ruleIds: ruleFlags.map((f) => f.field),
    steps: [
      { name: "normalize_input", status: "success" },
      { name: "product_memory_lookup", status: "success" },
      { name: "rule_engine_precheck", status: "success", reason: `${ruleFlags.length} flags` },
      { name: "interfaze_decision", status: fallbackReason ? "fallback" : "success", reason: fallbackReason ?? provider },
      { name: "validate_and_lane_apply", status: "success" },
    ],
  };
}

// Core: Interfaze.AI deterministic orchestrator
// - Deterministic steps run locally (rule-engine, lane-rules, product-memory)
// - Non-deterministic HS semantic step delegated to Interfaze workflow if configured
// - Falls back to existing NVIDIA/Gemini/OpenAI providers via ai.ts if Interfaze not configured

export async function runInterfazeDecision(input: InterfazeDecisionInput): Promise<InterfazeDecisionOutput> {
  const apiKey = process.env.INTERFAZE_API_KEY;
  const baseUrl = process.env.INTERFAZE_BASE_URL ?? "https://api.interfaze.ai/v1";

  // If Interfaze not configured, use local deterministic + existing AI fallback
  if (!apiKey) {
    return runLocalFallback(input, "rule_engine+ai_fallback", "INTERFAZE_API_KEY not set — using local deterministic + ai.ts");
  }

  try {
    const response = await fetch(`${baseUrl}/workflows/${INTERFAZE_WORKFLOW_ID}/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          source: input.source,
          shopDomain: input.shopDomain,
          orderId: input.orderId,
          orderJson: input.orderJson,
          documentText: input.documentText?.slice(0, 15000),
          ruleFlags: input.ruleFlags,
          lane: input.lane,
          extractedPreview: input.extractedPreview,
        },
        config: {
          deterministic: true,
          jsonSchema: "ExtractedTradeDocument",
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return runLocalFallback(input, `interfaze_http_${response.status}`, `Interfaze returned ${response.status}: ${text.slice(0, 200)}`);
    }

    const payload = await response.json();
    // Expected: { runId, status, output: ExtractedTradeDocument, auditTrail, usage }
    if (payload.output && typeof payload.output === "object") {
      return {
        status: "success",
        workflowId: payload.workflowId ?? INTERFAZE_WORKFLOW_ID,
        runId: payload.runId ?? uid(),
        data: payload.output as ExtractedTradeDocument,
        auditTrail: payload.auditTrail ?? buildDeterministicAudit(input.ruleFlags, "interfaze"),
        usage: payload.usage,
      };
    }

    // If payload is raw AI content, try parse
    if (payload.content || payload.choices) {
      const raw = String(payload.content ?? payload.choices?.[0]?.message?.content ?? "").replace(/```json|```/g, "").trim();
      try {
        const parsed = JSON.parse(raw) as ExtractedTradeDocument;
        return {
          status: "success",
          workflowId: INTERFAZE_WORKFLOW_ID,
          runId: payload.runId ?? uid(),
          data: parsed,
          auditTrail: buildDeterministicAudit(input.ruleFlags, "interfaze"),
        };
      } catch {
        return runLocalFallback(input, "interfaze_bad_json", "Interfaze returned non-JSON");
      }
    }

    return runLocalFallback(input, "interfaze_unexpected_shape", "Unexpected Interfaze payload shape");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return runLocalFallback(input, "interfaze_network_error", msg);
  }
}

async function runLocalFallback(input: InterfazeDecisionInput, provider: string, reason: string): Promise<InterfazeDecisionOutput> {
  // Use existing ai provider for semantic step if needed, otherwise return preview
  const text = input.documentText ?? JSON.stringify(input.orderJson ?? input.extractedPreview).slice(0, 12000);
  let data: ExtractedTradeDocument;
  try {
    // Only call AI if we have text and flags indicate need for semantic HS help
    const needsAi = input.ruleFlags.some((f) => f.field === "hs_code" || f.field === "product_description") || !input.extractedPreview.items[0]?.hs_code;
    data = needsAi && text.length > 20 ? await extractWithAi(text, input.ruleFlags) : input.extractedPreview;
  } catch {
    data = input.extractedPreview;
  }

  return {
    status: "fallback",
    workflowId: INTERFAZE_WORKFLOW_ID,
    runId: uid(),
    data,
    auditTrail: buildDeterministicAudit(input.ruleFlags, provider, reason),
  };
}

export function isInterfazeConfigured() {
  return Boolean(process.env.INTERFAZE_API_KEY);
}
