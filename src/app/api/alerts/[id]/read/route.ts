import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const alert = await prisma.tariffAlert.findFirst({ where: { id, userId: user.id } });
  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });

  await prisma.tariffAlert.update({ where: { id }, data: { isRead: true } });
  return NextResponse.json({ ok: true });
}
