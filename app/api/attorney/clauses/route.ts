import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptMessage, decryptMessage } from "@/lib/message-crypto";
import { LOCAL_USER_ID } from "@/lib/local-auth";
import type { ClauseEntry } from "@/types";

const CLAUSE_TITLE = "enc:" + encryptMessage("[CLAUSE_LIBRARY]");

export async function GET() {
  const session = await db.attorneySession.findFirst({
    where: { userId: LOCAL_USER_ID, tool: "CLAUSE" },
    select: { id: true, data: true },
  });

  if (!session) return NextResponse.json({ clauses: [] });

  try {
    const parsed = JSON.parse(session.data);
    if (parsed.__enc) {
      const decrypted = JSON.parse(decryptMessage(parsed.__enc));
      return NextResponse.json({ clauses: decrypted.clauses ?? [] });
    }
    return NextResponse.json({ clauses: (parsed as { clauses?: ClauseEntry[] }).clauses ?? [] });
  } catch {
    return NextResponse.json({ clauses: [] });
  }
}

export async function POST(req: NextRequest) {
  const { clauses } = await req.json();
  if (!Array.isArray(clauses))
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const storedData = JSON.stringify({ __enc: encryptMessage(JSON.stringify({ clauses })) });

  const existing = await db.attorneySession.findFirst({
    where: { userId: LOCAL_USER_ID, tool: "CLAUSE" },
    select: { id: true },
  });

  if (existing) {
    await db.attorneySession.update({
      where: { id: existing.id },
      data: { data: storedData, updatedAt: new Date() },
    });
  } else {
    await db.attorneySession.create({
      data: { userId: LOCAL_USER_ID, tool: "CLAUSE", title: CLAUSE_TITLE, data: storedData },
    });
  }

  return NextResponse.json({ ok: true });
}
