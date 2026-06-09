import { NextResponse } from "next/server";
import { db, ensureLocalUser } from "@/lib/db";
import { DEFAULT_MODEL, EMBEDDING_MODEL } from "@/lib/claude";

/**
 * Returns the current setup state:
 * - dbReady: local SQLite DB is accessible
 * - modelReady: the main Ollama model is pulled and ready
 * - embeddingReady: the embedding model is pulled and ready
 * - vectorsReady: the LanceDB vector store exists and has data
 */
export async function GET() {
  // Ensure local user exists
  try {
    await ensureLocalUser();
  } catch {
    return NextResponse.json({ dbReady: false, modelReady: false, embeddingReady: false, vectorsReady: false });
  }

  const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

  let modelReady = false;
  let embeddingReady = false;

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = (await res.json()) as { models: Array<{ name: string }> };
      const names = data.models.map((m) => m.name);
      modelReady = names.some((n) => n === DEFAULT_MODEL || n.startsWith(DEFAULT_MODEL.split(":")[0] + ":"));
      embeddingReady = names.some((n) => n === EMBEDDING_MODEL || n.startsWith(EMBEDDING_MODEL.split(":")[0] + ":"));
    }
  } catch {
    // Ollama not running yet
  }

  let vectorsReady = false;
  try {
    const lancedb = await import("@lancedb/lancedb");
    const path = await import("path");
    const dbPath = process.env.VECTOR_DB_PATH ?? path.join(process.cwd(), "data/vector-store");
    const vdb = await lancedb.connect(dbPath);
    const tables = await vdb.tableNames();
    vectorsReady = tables.includes("legal_chunks");
  } catch {
    // Vector store not built yet
  }

  return NextResponse.json({
    dbReady: true,
    modelReady,
    embeddingReady,
    vectorsReady,
    defaultModel: DEFAULT_MODEL,
    embeddingModel: EMBEDDING_MODEL,
  });
}
