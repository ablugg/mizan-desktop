import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { deleteUserLawChunks } from "@/lib/rag";
import { getLocalUserId } from "@/lib/local-auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = getLocalUserId();

  const law = await prisma.userLaw.findFirst({
    where: { id, userId },
  });

  if (!law) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteUserLawChunks(law.id);
  await prisma.userLaw.delete({ where: { id: law.id } });

  return NextResponse.json({ ok: true });
}
