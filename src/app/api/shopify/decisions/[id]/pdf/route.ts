import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const type = (request.nextUrl.searchParams.get("type") as "commercial_invoice" | "packing_list" | null) ?? "commercial_invoice";

  const d = await prisma.shipmentDecision.findFirst({ where: { id, userId: user.id } });
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const output = JSON.parse(d.outputJson || "{}");
  const audit = JSON.parse(d.auditTrailJson || "{}");
  const laneLabel = audit?.lane ?? d.lane;

  const pdf = await generateInvoicePdf(output, { type, laneLabel, orderName: d.shopifyOrderNumber });

  // mark generated
  await prisma.shipmentDecision.update({ where: { id }, data: { invoiceGenerated: true } });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${type}-${d.shopifyOrderNumber ?? d.shopifyOrderId ?? d.id}.pdf"`,
    },
  });
}
