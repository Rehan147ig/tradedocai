import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureStorage } from "@/lib/document-processing";
import { getPlan } from "@/lib/plans";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [documents, storage] = await Promise.all([
    prisma.document.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { uploadedAt: "desc" },
      take: 50,
      select: {
        id: true,
        originalFilename: true,
        documentType: true,
        status: true,
        confidenceScore: true,
        uploadedAt: true,
        expiresAt: true,
        fileSizeBytes: true,
      },
    }),
    ensureStorage(user.id, user.plan),
  ]);

  return NextResponse.json({
    user: {
      plan: user.plan,
      documentsUsedThisMonth: user.documentsUsedThisMonth,
    },
    storage: {
      totalBytesUsed: Number(storage.totalBytesUsed),
      storageLimitBytes: Number(storage.storageLimitBytes),
      documentCountThisMonth: storage.documentCountThisMonth,
      documentCountTotal: storage.documentCountTotal,
    },
    limits: getPlan(user.plan),
    documents,
  });
}
