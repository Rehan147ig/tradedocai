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
      plan: user.plan,
      documentsUsedThisMonth: user.documentsUsedThisMonth,
      monthlyResetDate: user.monthlyResetDate,
    },
  });
}
