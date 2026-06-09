import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptMessage } from "@/lib/message-crypto";
import { LOCAL_USER_ID } from "@/lib/local-auth";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_TEXT_CHARS = 25_000;

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  txt: "text/plain",
};

const SUPPORTED_TYPES = new Set(Object.values(MIME_BY_EXT));

function resolveMime(file: File): string {
  if (file.type && SUPPORTED_TYPES.has(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? file.type;
}

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "text/plain") return buffer.toString("utf-8");

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimeType === "application/pdf") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (await import("pdf2json")) as any;
    const PDFParser = mod.default ?? mod;
    return new Promise<string>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parser = new PDFParser(null, 1);
      const timeout = setTimeout(() => reject(new Error("PDF parsing timed out after 25s")), 25000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parser.on("pdfParser_dataReady", (data: any) => {
        clearTimeout(timeout);
        const text = (data.Pages ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((page: any) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (page.Texts ?? []).map((t: any) =>
              decodeURIComponent(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (t.R ?? []).map((r: any) => r.T ?? "").join("")
              )
            ).join(" ")
          )
          .join("\n");
        resolve(text);
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parser.on("pdfParser_dataError", (err: any) => {
        clearTimeout(timeout);
        reject(new Error(String(err?.parserError ?? err)));
      });
      parser.parseBuffer(buffer);
    });
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const conversationId = formData.get("conversationId") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!conversationId) return NextResponse.json({ error: "No conversationId" }, { status: 400 });

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds 4 MB limit" }, { status: 413 });
  }

  const mimeType = resolveMime(file);
  if (!SUPPORTED_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported file type. Please upload PDF, DOCX, or TXT.` },
      { status: 415 }
    );
  }

  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, userId: LOCAL_USER_ID },
  });
  if (!conversation)
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let extractedText: string;
  try {
    extractedText = await extractText(buffer, mimeType);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Failed to read document: ${msg}` }, { status: 422 });
  }

  const text = extractedText.slice(0, MAX_TEXT_CHARS);
  const document = await db.document.create({
    data: {
      conversationId,
      userId: LOCAL_USER_ID,
      name: file.name,
      mimeType,
      size: file.size,
      content: "[server-encrypted]",
      encryptedContent: encryptMessage(text),
    },
  });

  return NextResponse.json({
    document: { id: document.id, name: document.name, size: document.size, mimeType: document.mimeType },
  });
}

export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId)
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });

  const documents = await db.document.findMany({
    where: { conversationId, userId: LOCAL_USER_ID },
    select: { id: true, name: true, size: true, mimeType: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ documents });
}
