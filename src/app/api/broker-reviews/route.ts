import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isFeatureAllowed, requiredPlanFor } from "@/lib/plan-limits";

const schema = z.object({
  documentId: z.string().min(1),
  brokerEmail: z.string().email(),
  clientName: z.string().max(160).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFeatureAllowed(user.plan, "broker_handoff")) {
    return NextResponse.json({ error: "FEATURE_NOT_IN_PLAN", requiredPlan: requiredPlanFor("broker_handoff") }, { status: 403 });
  }

  const reviews = await prisma.brokerReview.findMany({
    where: { userId: user.id },
    include: { document: { select: { originalFilename: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ reviews });
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid broker review request" }, { status: 400 });
  }

  const document = await prisma.document.findFirst({
    where: { id: parsed.data.documentId, userId: user.id, deletedAt: null },
  });
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const review = await prisma.brokerReview.create({
    data: {
      userId: user.id,
      documentId: document.id,
      brokerEmail: parsed.data.brokerEmail,
      clientName: parsed.data.clientName?.trim() || null,
      note: parsed.data.note?.trim() || null,
    },
  });

  return NextResponse.json({ review });
}
