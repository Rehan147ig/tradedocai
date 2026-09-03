import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createToken, hashPassword } from "@/lib/auth";
import { getPlan } from "@/lib/plans";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).optional().nullable(),
  companyName: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and an 8+ character password." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
  }

  const resetDate = new Date();
  resetDate.setMonth(resetDate.getMonth() + 1);
  const free = getPlan("free");
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      hashedPassword: await hashPassword(parsed.data.password),
      fullName: parsed.data.fullName,
      companyName: parsed.data.companyName,
      monthlyResetDate: resetDate,
      storage: {
        create: {
          storageLimitBytes: BigInt(free.storageBytes),
        },
      },
    },
  });

  return NextResponse.json({
    token: await createToken(user.id),
    user: { id: user.id, email: user.email, plan: user.plan },
  });
}
