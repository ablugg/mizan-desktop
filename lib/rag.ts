import path from "path";
import { getOllama, EMBEDDING_MODEL } from "./claude";

// LanceDB is loaded dynamically to avoid build-time issues in non-Electron environments
async function getLanceDB() {
  const lancedb = await import("@lancedb/lancedb");
  return lancedb;
}

const TABLE_NAME = "legal_chunks";

let connectionCache: unknown = null;

async function getConnection() {
  if (connectionCache) return connectionCache as Awaited<ReturnType<(typeof import("@lancedb/lancedb"))["connect"]>>;

  const lancedb = await getLanceDB();
  const dbPath =
    process.env.VECTOR_DB_PATH ??
    path.join(process.cwd(), "data/vector-store");

  connectionCache = await lancedb.connect(dbPath);
  return connectionCache as Awaited<ReturnType<(typeof import("@lancedb/lancedb"))["connect"]>>;
}

async function embed(text: string): Promise<number[]> {
  const response = await getOllama().embeddings({
    model: EMBEDDING_MODEL,
    prompt: text,
  });
  return response.embedding;
}

export interface LegalChunk {
  id: string;
  text: string;
  source: string;
  jurisdiction: string;
  statute?: string;
  section?: string;
  language?: string;
}

export async function retrieveContext(
  query: string,
  topK = 5
): Promise<string> {
  try {
    const db = await getConnection();
    const table = await db.openTable(TABLE_NAME);
    const queryEmbedding = await embed(query);

    const results = await table
      .search(queryEmbedding)
      .limit(topK)
      .toArray();

    if (!results.length) return "";

    return results
      .map((r: LegalChunk) => {
        const meta = r as LegalChunk;
        return `[${meta.source} -- ${meta.jurisdiction}${meta.statute ? ` -- ${meta.statute}` : ""}]\n${meta.text}`;
      })
      .join("\n\n---\n\n");
  } catch (err) {
    console.error("RAG retrieval failed:", err);
    return "";
  }
}

export async function addUserLaw(doc: {
  text: string;
  source: string;
  jurisdiction?: string;
  statute?: string;
  language?: string;
}): Promise<void> {
  const { chunkText } = await import("../data/ingestion/build-vectors");
  const lancedb = await getLanceDB();
  const db = await getConnection();

  const chunks = chunkText(doc.text);
  const records = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embed(chunks[i]);
    records.push({
      id: `user-${doc.source.replace(/[^a-z0-9]/gi, "-")}-${i}`,
      vector: embedding,
      text: chunks[i],
      source: doc.source,
      jurisdiction: doc.jurisdiction ?? "User-added",
      statute: doc.statute ?? "",
      section: "",
      language: doc.language ?? "en",
    });
  }

  try {
    const table = await db.openTable(TABLE_NAME);
    await table.add(records);
  } catch {
    // Table doesn't exist yet -- create it
    await db.createTable(TABLE_NAME, records);
  }
}
