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

export async function GET() {
  const conversations = await db.conversation.findMany({
    where: { userId: LOCAL_USER_ID },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      pinned: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        where: { role: "user" },
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { content: true, role: true, encryptedContent: true },
      },
    },
  });

  return NextResponse.json({
    conversations: conversations.map((c) => {
      const raw = c.messages[0] ?? null;
      let lastMessage = raw;
      if (raw?.content === "[server-encrypted]" && raw.encryptedContent) {
        try {
          lastMessage = {
            ...raw,
            content: decryptMessage(raw.encryptedContent),
            encryptedContent: null,
          };
        } catch {
          lastMessage = { ...raw, content: "", encryptedContent: null };
        }
      }
      return {
        id: c.id,
        title: decryptTitle(c.title),
        pinned: c.pinned,
        updatedAt: c.updatedAt,
        lastMessage,
      };
    }),
  });
}

export async function POST() {
  const conversation = await db.conversation.create({
    data: { userId: LOCAL_USER_ID },
  });
  return NextResponse.json({ conversation });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await db.conversation.deleteMany({ where: { id, userId: LOCAL_USER_ID } });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const { id, pinned } = await req.json();
  await db.conversation.updateMany({
    where: { id, userId: LOCAL_USER_ID },
    data: { pinned },
  });
  return NextResponse.json({ success: true });
}
