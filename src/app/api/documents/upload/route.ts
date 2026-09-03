import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { createAndProcessDocument } from "@/lib/document-processing";
import { TRADE_LANES, TradeLane } from "@/lib/lane-rules";
import { isFeatureAllowed, isLaneAllowed, planLimit, requiredPlanFor, startOfCurrentMonth } from "@/lib/plan-limits";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a document file." }, { status: 400 });
  }
  const laneValue = String(form.get("lane") ?? "global");
  const lane = laneValue in TRADE_LANES ? (laneValue as TradeLane) : "global";
  const mode = String(form.get("mode") ?? "single");
  const limits = planLimit(user.plan);

  if (mode === "bulk" && !isFeatureAllowed(user.plan, "bulk_upload")) {
    return NextResponse.json({ error: "FEATURE_NOT_IN_PLAN", requiredPlan: requiredPlanFor("bulk_upload") }, { status: 403 });
  }
  if (!isLaneAllowed(user.plan, lane)) {
    return NextResponse.json({ error: "FEATURE_NOT_IN_PLAN", requiredPlan: "starter" }, { status: 403 });
  }
  if (limits.checks_per_month !== -1) {
    const count = await prisma.document.count({ where: { userId: user.id, uploadedAt: { gte: startOfCurrentMonth() } } });
    if (count >= limits.checks_per_month) {
      return NextResponse.json({ error: "PLAN_LIMIT_REACHED", plan: user.plan, limit: limits.checks_per_month }, { status: 403 });
    }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const documentId = await createAndProcessDocument(user.id, file.name, buffer, lane);
    return NextResponse.json({ documentId, status: "processing" }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status = message.includes("limit") || message.includes("Storage") ? 403 : message.includes("large") ? 413 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
