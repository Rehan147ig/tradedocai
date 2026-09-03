import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const d = await prisma.shipmentDecision.findFirst({ where: { id, userId: user.id } });
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    decision: {
      ...d,
      hsRecommendations: safeParse(d.hsRecommendationsJson, []),
      flags: safeParse(d.flagsJson, []),
      auditTrail: safeParse(d.auditTrailJson, {}),
      output: safeParse(d.outputJson, {}),
      carrierPayload: safeParse(d.carrierPayloadJson, {}),
    },
  });
}

function safeParse(s: string, fallback: unknown) { try { return JSON.parse(s); } catch { return fallback; } }
