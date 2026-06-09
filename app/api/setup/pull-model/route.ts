import { NextRequest, NextResponse } from "next/server";

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

/**
 * Streams Ollama pull progress as newline-delimited JSON.
 * Body: { model: string }
 */
export async function POST(req: NextRequest) {
  const { model } = await req.json();
  if (!model) return NextResponse.json({ error: "Missing model name" }, { status: 400 });

  const ollamaRes = await fetch(`${OLLAMA_HOST}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: model, stream: true }),
  });

  if (!ollamaRes.body)
    return NextResponse.json({ error: "Ollama not reachable" }, { status: 503 });

  // Pipe the Ollama stream directly through to the client
  return new Response(ollamaRes.body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
