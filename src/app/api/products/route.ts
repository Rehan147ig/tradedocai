import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { planLimit } from "@/lib/plan-limits";

const productSchema = z.object({
  sku: z.string().min(1).max(80),
  name: z.string().min(2).max(160),
  customsDescription: z.string().min(8).max(500),
  hsCode: z.string().regex(/^\d{6,10}$/, "HS code must be 6 to 10 digits"),
  countryOfOrigin: z.string().min(2).max(80),
  material: z.string().max(120).optional().nullable(),
  defaultLane: z.string().max(80).optional().nullable(),
  confidenceNote: z.string().max(500).optional().nullable(),
});

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await prisma.product.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = productSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid product data" }, { status: 400 });
  }

  const limits = planLimit(user.plan);
  if (limits.sku_memory_limit !== -1) {
    const skuCount = await prisma.product.count({ where: { userId: user.id } });
    const existing = await prisma.product.findUnique({ where: { userId_sku: { userId: user.id, sku: parsed.data.sku.trim() } } });
    if (!existing && skuCount >= limits.sku_memory_limit) {
      return NextResponse.json({ error: "SKU_LIMIT_REACHED", requiredPlan: "pro" }, { status: 403 });
    }
  }

  const product = await prisma.product.upsert({
    where: { userId_sku: { userId: user.id, sku: parsed.data.sku.trim() } },
    update: {
      name: parsed.data.name.trim(),
      customsDescription: parsed.data.customsDescription.trim(),
      hsCode: parsed.data.hsCode.trim(),
      countryOfOrigin: parsed.data.countryOfOrigin.trim(),
      material: parsed.data.material?.trim() || null,
      defaultLane: parsed.data.defaultLane?.trim() || null,
      confidenceNote: parsed.data.confidenceNote?.trim() || null,
    },
    create: {
      userId: user.id,
      sku: parsed.data.sku.trim(),
      name: parsed.data.name.trim(),
      customsDescription: parsed.data.customsDescription.trim(),
      hsCode: parsed.data.hsCode.trim(),
      countryOfOrigin: parsed.data.countryOfOrigin.trim(),
      material: parsed.data.material?.trim() || null,
      defaultLane: parsed.data.defaultLane?.trim() || null,
      confidenceNote: parsed.data.confidenceNote?.trim() || null,
    },
  });

  return NextResponse.json({ product });
}
