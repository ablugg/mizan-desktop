import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptMessage } from "@/lib/message-crypto";
import { LOCAL_USER_ID } from "@/lib/local-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const conversation = await db.conversation.findFirst({
    where: { id, userId: LOCAL_USER_ID },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          encryptedContent: true,
          citations: true,
          attachedFiles: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation) return NextResponse.json({ notFound: true, messages: [] });

  const messages = conversation.messages.map((msg) => {
    const decoded = {
      ...msg,
      citations: msg.citations ? (() => { try { return JSON.parse(msg.citations!); } catch { return null; } })() : null,
      attachedFiles: msg.attachedFiles ? (() => { try { return JSON.parse(msg.attachedFiles!); } catch { return null; } })() : null,
    };
    if (msg.content === "[server-encrypted]" && msg.encryptedContent) {
      try {
        return { ...decoded, content: decryptMessage(msg.encryptedContent), encryptedContent: null };
      } catch {
        return { ...decoded, content: "[message unavailable]", encryptedContent: null };
      }
    }
    return decoded;
  });

  return NextResponse.json({ messages });
}
