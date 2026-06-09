import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { addUserLaw } from "@/lib/rag";
import { parseDocumentBuffer } from "@/lib/parse-document";
import { getLocalUserId } from "@/lib/local-auth";

export async function GET() {
  const userId = getLocalUserId();

  const laws = await prisma.userLaw.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ laws });
}

export async function POST(req: NextRequest) {
  const userId = getLocalUserId();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const source = (formData.get("source") as string)?.trim();
  const statute = (formData.get("statute") as string | null)?.trim() ?? "";
  const language = (formData.get("language") as string | null)?.trim() ?? "en";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!source) return NextResponse.json({ error: "Source name is required" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";
  try {
    text = await parseDocumentBuffer(buffer, file.name, file.type);
  } catch {
    return NextResponse.json({ error: "Could not extract text from document" }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "Document appears to be empty" }, { status: 400 });
  }

  // Create the DB record first so we have the ID for chunk naming
  const law = await prisma.userLaw.create({
    data: {
      userId,
      source,
      statute,
      fileName: file.name,
      language,
      chunkCount: 0,
    },
  });

  let chunkCount = 0;
  try {
    chunkCount = await addUserLaw({
      lawId: law.id,
      text,
      source,
      jurisdiction: "User-added",
      statute,
      language,
    });
  } catch (err) {
    await prisma.userLaw.delete({ where: { id: law.id } });
    console.error("Vector ingestion failed:", err);
    return NextResponse.json({ error: "Failed to ingest document into vector store" }, { status: 500 });
  }

  const updated = await prisma.userLaw.update({
    where: { id: law.id },
    data: { chunkCount },
  });

  return NextResponse.json({ law: updated });
}
