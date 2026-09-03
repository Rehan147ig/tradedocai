import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      companyName: user.companyName,
      companyCountry: (user as unknown as Record<string, string | null>).companyCountry ?? null,
      companyAddress: (user as unknown as Record<string, string | null>).companyAddress ?? null,
      plan: user.plan,
      documentsUsedThisMonth: user.documentsUsedThisMonth,
      monthlyResetDate: user.monthlyResetDate,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, string>;
  const data: Record<string, string | null> = {};
  if (typeof body.fullName === "string") data.fullName = body.fullName.trim() || null;
  if (typeof body.companyName === "string") data.companyName = body.companyName.trim() || null;
  if (typeof body.companyCountry === "string") data.companyCountry = body.companyCountry.trim() || null;
  if (typeof body.companyAddress === "string") data.companyAddress = body.companyAddress.trim() || null;
  if (!Object.keys(data).length) return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  const { prisma } = await import("@/lib/db");
  const updated = await prisma.user.update({ where: { id: user.id }, data: data as never });
  return NextResponse.json({ user: { id: updated.id, email: updated.email, fullName: updated.fullName, companyName: updated.companyName, companyCountry: (updated as unknown as Record<string, string | null>).companyCountry ?? null, companyAddress: (updated as unknown as Record<string, string | null>).companyAddress ?? null, plan: updated.plan } });
}
