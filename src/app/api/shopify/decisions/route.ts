import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orderId = request.nextUrl.searchParams.get("orderId");
  const where: Record<string, unknown> = { userId: user.id };
  if (orderId) where.shopifyOrderId = orderId;

  const decisions = await prisma.shipmentDecision.findMany({
    where: where as never,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Parse JSON fields for client convenience
  const parsed = decisions.map((d) => ({
    ...d,
    hsRecommendations: safeParse(d.hsRecommendationsJson, []),
    flags: safeParse(d.flagsJson, []),
    auditTrail: safeParse(d.auditTrailJson, {}),
    output: safeParse(d.outputJson, {}),
    carrierPayload: safeParse(d.carrierPayloadJson, {}),
  }));

  return NextResponse.json({ decisions: parsed });
}

function safeParse(s: string, fallback: unknown) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}
