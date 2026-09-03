import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true, note: "Paddle webhook endpoint reserved for sandbox signature verification." });
}
