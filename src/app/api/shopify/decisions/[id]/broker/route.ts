import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { brokerEmail?: string; note?: string; action?: string; feedback?: string };
  const d = await prisma.shipmentDecision.findFirst({ where: { id, userId: user.id } });
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Broker portal actions: request, approve, reject (brokerToken flow handled in public route)
  if (body.action === "broker_approve" || body.action === "broker_reject") {
    const updated = await prisma.shipmentDecision.update({ where: { id }, data: { brokerStatus: body.action === "broker_approve" ? "approved" : "rejected", brokerNote: body.feedback ?? d.brokerNote } as never });
    return NextResponse.json({ ok: true, decision: updated });
  }

  if (!body.brokerEmail || !body.brokerEmail.includes("@")) return NextResponse.json({ error: "brokerEmail required" }, { status: 400 });

  const token = d.brokerToken ?? randomUUID().replace(/-/g, "").slice(0, 24);
  const appUrl = process.env.SHOPIFY_APP_URL ?? request.nextUrl.origin;
  const link = `${appUrl}/broker/view/${token}`;

  const updated = await prisma.shipmentDecision.update({
    where: { id },
    data: { brokerEmail: body.brokerEmail, brokerNote: body.note ?? null, brokerStatus: "requested", brokerToken: token } as never,
  });

  // In prod, send email via Resend/Sendgrid here. For easy MVP, just return link.
  return NextResponse.json({ ok: true, decision: updated, brokerLink: link, message: "Broker link generated — share it (no login needed)." });
}
