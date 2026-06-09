import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptMessage } from "@/lib/message-crypto";
import { LOCAL_USER_ID } from "@/lib/local-auth";

function decryptTitle(stored: string): string {
  if (stored.startsWith("enc:")) {
    try {
      return decryptMessage(stored.slice(4));
    } catch {
      return stored;
    }
  }
  return stored;
}

function decryptData(stored: string): unknown {
  try {
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === "object" && "__enc" in parsed) {
      return JSON.parse(decryptMessage(parsed.__enc));
    }
    return parsed;
  } catch {
    return stored;
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await db.attorneySession.findFirst({ where: { id, userId: LOCAL_USER_ID } });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    session: {
      ...session,
      title: decryptTitle(session.title),
      data: decryptData(session.data),
    },
  });
}
