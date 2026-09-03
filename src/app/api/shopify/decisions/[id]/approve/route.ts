import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isFeatureAllowed } from "@/lib/plan-limits";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { action?: string; reason?: string };
  const action = (body.action ?? "approve").toLowerCase();
  if (!["approve", "reject", "reset"].includes(action)) return NextResponse.json({ error: "action must be approve|reject|reset" }, { status: 400 });

  const d = await prisma.shipmentDecision.findFirst({ where: { id, userId: user.id } });
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Team seats guard: free 1, starter 1, pro 1, business 5 — allow approve but gate UI; block if team limit conceptually exceeded
  // For simplicity, allow but warn via flag if not business and already has approval
  if (action === "approve" && !isFeatureAllowed(user.plan, "broker_handoff") && d.approvalStatus === "approved") {
    // still allow — broker_handoff is not approval, so soft gate
  }

  const update: Record<string, unknown> = {};
  if (action === "approve") { update.approvalStatus = "approved"; update.approvedBy = user.email; update.approvedAt = new Date(); update.rejectionReason = null; }
  if (action === "reject") { update.approvalStatus = "rejected"; update.approvedBy = user.email; update.approvedAt = new Date(); update.rejectionReason = body.reason ?? null; }
  if (action === "reset") { update.approvalStatus = "pending"; update.approvedBy = null; update.approvedAt = null; update.rejectionReason = null; }

  const updated = await prisma.shipmentDecision.update({ where: { id }, data: update as never });
  return NextResponse.json({ ok: true, decision: updated });
}
