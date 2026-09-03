import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  });
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await prisma.document.update({ where: { id }, data: { lastViewedAt: new Date() } });

  return NextResponse.json({
    document: {
      id: document.id,
      originalFilename: document.originalFilename,
      status: document.status,
      confidenceScore: document.confidenceScore,
      processingTimeMs: document.processingTimeMs,
      uploadedAt: document.uploadedAt,
      extractedData: JSON.parse(document.extractedDataJson || "{}"),
      validationFlags: JSON.parse(document.validationFlagsJson || "[]"),
    },
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.document.findFirst({ where: { id, userId: user.id, deletedAt: null } });
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
