import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { extractWithAi } from "@/lib/ai";
import { runConsistencyChecks, CrossCheckDocType } from "@/lib/cross-check";
import { extractTextFromUpload } from "@/lib/pdf";
import { isFeatureAllowed, requiredPlanFor } from "@/lib/plan-limits";

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFeatureAllowed(user.plan, "cross_check")) {
    return NextResponse.json({ error: "FEATURE_NOT_IN_PLAN", requiredPlan: requiredPlanFor("cross_check") }, { status: 403 });
  }

  const form = await request.formData();
  const types: CrossCheckDocType[] = ["invoice", "packing_list", "bol"];
  const extracted: Partial<Record<CrossCheckDocType, Awaited<ReturnType<typeof extractWithAi>>>> = {};

  for (const type of types) {
    const file = form.get(type);
    if (!(file instanceof File)) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromUpload(buffer, "pdf");
    extracted[type] = await extractWithAi(text);
  }

  if (Object.keys(extracted).length < 2) {
    return NextResponse.json({ error: "Upload at least two documents to compare." }, { status: 400 });
  }

  const checks = runConsistencyChecks(extracted);
  return NextResponse.json({
    checks,
    summary: {
      total: checks.length,
      mismatches: checks.filter((check) => check.status !== "match").length,
      critical: checks.filter((check) => check.status !== "match" && check.severity === "critical").length,
    },
  });
}
