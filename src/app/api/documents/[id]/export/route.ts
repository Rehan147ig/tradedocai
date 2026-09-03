import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlan } from "@/lib/plans";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!getPlan(user.plan).export) return NextResponse.json({ error: "Upgrade to export reports." }, { status: 403 });

  const { id } = await params;
  const document = await prisma.document.findFirst({ where: { id, userId: user.id, deletedAt: null } });
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await prisma.document.update({ where: { id }, data: { lastExportedAt: new Date() } });
  return new NextResponse(document.extractedDataJson, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${document.originalFilename}.json"`,
    },
  });
}
