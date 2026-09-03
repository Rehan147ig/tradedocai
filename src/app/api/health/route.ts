import { NextResponse } from "next/server";
import { isInterfazeConfigured } from "@/lib/interfaze";

export async function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    interfaze: {
      configured: isInterfazeConfigured(),
      workflowId: process.env.INTERFAZE_WORKFLOW_ID ?? "clearship-decision-v1",
      baseUrl: process.env.INTERFAZE_BASE_URL ?? "https://api.interfaze.ai/v1",
      provider: process.env.AI_PROVIDER ?? "interfaze",
      mode: isInterfazeConfigured() ? "interfaze-deterministic" : "local-fallback (rule_engine+ai.ts)",
    },
    shopify: {
      configured: Boolean(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET),
      appUrl: process.env.SHOPIFY_APP_URL ?? null,
    },
    build: "clearship-ai",
  });
}
