import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LOCAL_USER_ID } from "@/lib/local-auth";
import bcrypt from "bcryptjs";

export async function GET() {
  const user = await db.user.findUnique({
    where: { id: LOCAL_USER_ID },
    select: { passwordHash: true },
  });
  return NextResponse.json({ pinSet: !!user?.passwordHash });
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!password) return NextResponse.json({ ok: false, error: "Password required" }, { status: 400 });

  const user = await db.user.findUnique({
    where: { id: LOCAL_USER_ID },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    // No PIN set yet -- allow unlock (first-time setup)
    return NextResponse.json({ ok: true });
  }

  const verified = await bcrypt.compare(password, user.passwordHash);
  return NextResponse.json({ ok: verified, error: verified ? undefined : "Incorrect PIN." });
}

// PUT -- set or update the PIN
export async function PUT(req: NextRequest) {
  const { password } = await req.json();
  if (!password || password.length < 4)
    return NextResponse.json({ ok: false, error: "PIN must be at least 4 characters" }, { status: 400 });

  const hash = await bcrypt.hash(password, 10);
  await db.user.update({ where: { id: LOCAL_USER_ID }, data: { passwordHash: hash } });
  return NextResponse.json({ ok: true });
}
