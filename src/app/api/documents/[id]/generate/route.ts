import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateBrokerSummary, generateCorrectionChecklist, generateCustomerDutyNotice } from "@/lib/document-generator";
import { ExtractedTradeDocument } from "@/lib/validators";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const type = request.nextUrl.searchParams.get("type") ?? "broker-summary";
  const document = await prisma.document.findFirst({ where: { id, userId: user.id, deletedAt: null } });
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const data = JSON.parse(document.extractedDataJson || "{}") as ExtractedTradeDocument;
  if (type === "correction-checklist") {
    return NextResponse.json(generateCorrectionChecklist(data));
  }

  if (type === "customer-duty-notice") {
    return new NextResponse(generateCustomerDutyNotice(data), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse(generateBrokerSummary(data), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
