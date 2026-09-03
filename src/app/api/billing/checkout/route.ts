import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";

const schema = z.object({
  plan: z.enum(["starter", "pro", "broker"]),
});

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid plan." }, { status: 400 });

  if (!process.env.PADDLE_API_KEY) {
    return NextResponse.json({
      checkoutUrl: "/pricing",
      note: "Paddle is not configured yet. Add PADDLE_API_KEY and price IDs to enable hosted checkout.",
    });
  }

  return NextResponse.json({
    checkoutUrl: "/pricing",
    note: "Paddle checkout shell is ready. Wire transaction creation after Paddle sandbox products are created.",
  });
}
