import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { seedDemoAlerts } from "@/lib/seed-alerts";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unreadOnly = request.nextUrl.searchParams.get("unread") === "1";
  let alerts = await prisma.tariffAlert.findMany({
    where: { userId: user.id, ...(unreadOnly ? { isRead: false } : {}) },
    include: { sku: { select: { sku: true, name: true, hsCode: true } } },
    orderBy: { createdAt: "desc" },
  });

  const accountAgeMs = Date.now() - user.createdAt.getTime();
  if (alerts.length === 0 && accountAgeMs < 7 * 24 * 60 * 60 * 1000) {
    await seedDemoAlerts(user.id);
    alerts = await prisma.tariffAlert.findMany({
      where: { userId: user.id, ...(unreadOnly ? { isRead: false } : {}) },
      include: { sku: { select: { sku: true, name: true, hsCode: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  return NextResponse.json({ alerts, unreadCount: alerts.filter((alert) => !alert.isRead).length });
}
