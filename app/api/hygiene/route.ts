import { NextRequest, NextResponse } from "next/server";
import { db, ensureLocalUser } from "@/lib/db";

const RETENTION_DAYS = 7;

/**
 * GET -- run hygiene pass: delete unpinned conversations older than 7 days.
 * Called once on app startup from the client.
 */
export async function GET() {
  await ensureLocalUser();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const { count } = await db.conversation.deleteMany({
    where: {
      pinned: false,
      updatedAt: { lt: cutoff },
    },
  });

  if (count > 0) {
    console.log(`[hygiene] Deleted ${count} conversation(s) older than ${RETENTION_DAYS} days`);
  }

  return NextResponse.json({ deleted: count });
}

/**
 * PATCH -- toggle pinned on a conversation.
 * Body: { id: string, pinned: boolean }
 */
export async function PATCH(req: NextRequest) {
  const { id, pinned } = await req.json();
  if (!id || typeof pinned !== "boolean")
    return NextResponse.json({ error: "Missing id or pinned" }, { status: 400 });

  await db.conversation.updateMany({
    where: { id },
    data: { pinned },
  });

  return NextResponse.json({ ok: true });
}
