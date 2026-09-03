import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildCarrierEdi, CarrierFormat } from "@/lib/carrier";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const format = (request.nextUrl.searchParams.get("format") as CarrierFormat | null) ?? "generic";
  const allowed: CarrierFormat[] = ["generic", "easyship", "dhl", "ups"];
  const fmt: CarrierFormat = allowed.includes(format) ? format : "generic";

  const d = await prisma.shipmentDecision.findFirst({ where: { id, userId: user.id } });
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const output = JSON.parse(d.outputJson || "{}");
  const audit = JSON.parse(d.auditTrailJson || "{}");

  const edi = buildCarrierEdi(output, audit, { format: fmt, orderName: d.shopifyOrderNumber, reference: d.shopifyOrderNumber ?? d.shopifyOrderId ?? d.id });

  // JSON response by default; ?download=1 for file
  if (request.nextUrl.searchParams.get("download") === "1") {
    return new NextResponse(JSON.stringify(edi, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="carrier-${fmt}-${d.shopifyOrderNumber ?? d.id}.json"`,
      },
    });
  }
  return NextResponse.json({ decisionId: d.id, format: fmt, edi });
}
