import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: { status: true, confidenceScore: true },
  });
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  return NextResponse.json({ status: document.status, confidence: document.confidenceScore });
}
