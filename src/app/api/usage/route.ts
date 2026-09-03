import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { ensureStorage } from "@/lib/document-processing";
import { getPlan } from "@/lib/plans";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limits = getPlan(user.plan);
  const storage = await ensureStorage(user.id, user.plan);

  return NextResponse.json({
    used: user.documentsUsedThisMonth,
    limit: limits.docsPerMonth,
    plan: user.plan,
    resetDate: user.monthlyResetDate,
    storageUsed: Number(storage.totalBytesUsed),
    storageLimit: limits.storageBytes,
  });
}
