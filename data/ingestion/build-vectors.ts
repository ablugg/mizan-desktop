/**
 * Builds the local LanceDB vector store from data/sources/ text files.
 * Uses Ollama's nomic-embed-text model for embeddings.
 *
 * Run with: npm run build:vectors
 * Requires Ollama to be running with nomic-embed-text pulled.
 */
import { config } from "dotenv";
config({ path: ".env" });

import * as fs from "fs";
import * as path from "path";
import { Ollama } from "ollama";

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";
const VECTOR_DB_PATH = process.env.VECTOR_DB_PATH ?? path.join(process.cwd(), "data/vector-store");
const TABLE_NAME = "legal_chunks";
const CHUNK_SIZE = 400;
const CHUNK_OVERLAP = 50;

const ollama = new Ollama({ host: OLLAMA_HOST });

export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim().length > 50) chunks.push(chunk.trim());
  }
  return chunks;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (const text of texts) {
    const res = await ollama.embeddings({ model: EMBEDDING_MODEL, prompt: text });
    embeddings.push(res.embedding);
  }
  return embeddings;
}

const SOURCES: Array<{
  file: string;
  source: string;
  statute?: string;
  language: string;
}> = [
  { file: "labour-law-en.txt", source: "Saudi Labour Law", statute: "Royal Decree No. M/51", language: "en" },
  { file: "labour-law-ar.txt", source: "Saudi Labour Law", statute: "Royal Decree No. M/51", language: "ar" },
  { file: "civil-transactions-law-en.txt", source: "Civil Transactions Law", statute: "Royal Decree No. M/191", language: "en" },
  { file: "civil-transactions-law-ar.txt", source: "Civil Transactions Law", statute: "Royal Decree No. M/191", language: "ar" },
  { file: "family-law-en.txt", source: "Family Law", statute: "Royal Decree No. M/73", language: "en" },
  { file: "family-law-ar.txt", source: "Family Law", statute: "Royal Decree No. M/73", language: "ar" },
  { file: "regulations-of-the-family-law-en.txt", source: "Regulations of the Family Law", statute: "Royal Order No. 59641", language: "en" },
  { file: "regulations-of-the-family-law-ar.txt", source: "Regulations of the Family Law", statute: "Royal Order No. 59641", language: "ar" },
  { file: "law-of-evidence-en.txt", source: "Law of Evidence", statute: "Royal Decree No. M/43", language: "en" },
  { file: "law-of-evidence-ar.txt", source: "Law of Evidence", statute: "Royal Decree No. M/43", language: "ar" },
  { file: "procedural-manuals-for-the-evidentiary-law-en.txt", source: "Procedural Manuals for the Evidentiary Law", statute: "Minister of Justice Decision No. 921", language: "en" },
  { file: "procedural-manuals-for-the-evidentiary-law-ar.txt", source: "Procedural Manuals for the Evidentiary Law", statute: "Minister of Justice Decision No. 921", language: "ar" },
  { file: "law-of-commercial-courts-en.txt", source: "Law of Commercial Courts", statute: "Royal Decree No. M/93", language: "en" },
  { file: "law-of-commercial-courts-ar.txt", source: "Law of Commercial Courts", statute: "Royal Decree No. M/93", language: "ar" },
  { file: "the-implementing-regulations-of-the-commercial-courts-law-en.txt", source: "Implementing Regulations of the Commercial Courts Law", statute: "Minister of Justice Decision No. 8344", language: "en" },
  { file: "the-implementing-regulations-of-the-commercial-courts-law-ar.txt", source: "Implementing Regulations of the Commercial Courts Law", statute: "Minister of Justice Decision No. 8344", language: "ar" },
  { file: "bankruptcy-law-en.txt", source: "Bankruptcy Law", statute: "Royal Decree No. M/50", language: "en" },
  { file: "bankruptcy-law-ar.txt", source: "Bankruptcy Law", statute: "Royal Decree No. M/50", language: "ar" },
  { file: "implementing-regulations-of-the-bankruptcy-law-en.txt", source: "Implementing Regulations of the Bankruptcy Law", statute: "Council of Ministers Resolution No. 622", language: "en" },
  { file: "implementing-regulations-of-the-bankruptcy-law-ar.txt", source: "Implementing Regulations of the Bankruptcy Law", statute: "Council of Ministers Resolution No. 622", language: "ar" },
  { file: "law-of-arbitration-en.txt", source: "Law of Arbitration", statute: "Royal Decree No. M/34", language: "en" },
  { file: "law-of-arbitration-ar.txt", source: "Law of Arbitration", statute: "Royal Decree No. M/34", language: "ar" },
  { file: "implementing-regulations-of-the-law-of-arbitration-en.txt", source: "Implementing Regulations of the Law of Arbitration", statute: "Council of Ministers Resolution No. 541", language: "en" },
  { file: "implementing-regulations-of-the-law-of-arbitration-ar.txt", source: "Implementing Regulations of the Law of Arbitration", statute: "Council of Ministers Resolution No. 541", language: "ar" },
  { file: "law-of-real-estate-registration-en.txt", source: "Law of Real Estate Registration", statute: "Royal Decree No. M/91", language: "en" },
  { file: "law-of-real-estate-registration-ar.txt", source: "Law of Real Estate Registration", statute: "Royal Decree No. M/91", language: "ar" },
  { file: "law-of-real-estate-ownership-by-non-saudis-en.txt", source: "Law of Real Estate Ownership by Non-Saudis", statute: "Royal Decree No. M/14", language: "en" },
  { file: "law-of-real-estate-ownership-by-non-saudis-ar.txt", source: "Law of Real Estate Ownership by Non-Saudis", statute: "Royal Decree No. M/14", language: "ar" },
  { file: "anti-money-laundering-law-en.txt", source: "Anti-Money Laundering Law", statute: "Royal Decree No. M/20", language: "en" },
  { file: "anti-money-laundering-law-ar.txt", source: "Anti-Money Laundering Law", statute: "Royal Decree No. M/20", language: "ar" },
  { file: "law-of-combating-crimes-of-terrorism-and-its-financing-en.txt", source: "Law of Combating Crimes of Terrorism and its Financing", statute: "Royal Decree No. M/21", language: "en" },
  { file: "law-of-combating-crimes-of-terrorism-and-its-financing-ar.txt", source: "Law of Combating Crimes of Terrorism and its Financing", statute: "Royal Decree No. M/21", language: "ar" },
  { file: "implementing-regulations-of-the-law-of-criminal-procedure-en.txt", source: "Implementing Regulations of the Law of Criminal Procedure", statute: "Council of Ministers Resolution No. 142", language: "en" },
  { file: "implementing-regulations-of-the-law-of-criminal-procedure-ar.txt", source: "Implementing Regulations of the Law of Criminal Procedure", statute: "Council of Ministers Resolution No. 142", language: "ar" },
  { file: "notarization-law-en.txt", source: "Notarization Law", statute: "Royal Decree No. M/164", language: "en" },
  { file: "notarization-law-ar.txt", source: "Notarization Law", statute: "Royal Decree No. M/164", language: "ar" },
  { file: "law-on-the-protection-of-informants-witnesses-experts-and-victims-en.txt", source: "Law on the Protection of Informants, Witnesses, Experts, and Victims", statute: "Royal Decree No. M/148", language: "en" },
  { file: "law-on-the-protection-of-informants-witnesses-experts-and-victims-ar.txt", source: "Law on the Protection of Informants, Witnesses, Experts, and Victims", statute: "Royal Decree No. M/148", language: "ar" },
  { file: "juveniles-law-en.txt", source: "Juveniles Law", statute: "Royal Decree No. M/113", language: "en" },
  { file: "juveniles-law-ar.txt", source: "Juveniles Law", statute: "Royal Decree No. M/113", language: "ar" },
  { file: "implementing-regulations-of-the-juveniles-law-en.txt", source: "Implementing Regulations of the Juveniles Law", statute: "Council of Ministers Resolution No. 237", language: "en" },
  { file: "implementing-regulations-of-the-juveniles-law-ar.txt", source: "Implementing Regulations of the Juveniles Law", statute: "Council of Ministers Resolution No. 237", language: "ar" },
  { file: "law-of-criminal-procedure-annotated-ar.txt", source: "Law of Criminal Procedure -- Annotated Consolidated Edition", statute: "Royal Decree No. M/2 (Annotated, MOJ Research Centre 1442H)", language: "ar" },
  { file: "implementing-regulations-of-the-code-of-law-practice-en.txt", source: "Implementing Regulations of the Code of Law Practice", statute: "Minister of Justice Decision No. 676", language: "en" },
  { file: "implementing-regulations-of-the-code-of-law-practice-ar.txt", source: "Implementing Regulations of the Code of Law Practice", statute: "Minister of Justice Decision No. 676", language: "ar" },
  { file: "rules-of-professional-conduct-for-lawyers-en.txt", source: "Rules of Professional Conduct for Lawyers", statute: "Minister of Justice Decision No. 3453", language: "en" },
  { file: "rules-of-professional-conduct-for-lawyers-ar.txt", source: "Rules of Professional Conduct for Lawyers", statute: "Minister of Justice Decision No. 3453", language: "ar" },
  { file: "law-of-judicial-fees-en.txt", source: "Law of Judicial Fees", statute: "Royal Decree No. M/16", language: "en" },
  { file: "law-of-judicial-fees-ar.txt", source: "Law of Judicial Fees", statute: "Royal Decree No. M/16", language: "ar" },
  { file: "the-implementing-regulations-of-the-enforcement-law-en.txt", source: "Implementing Regulations of the Enforcement Law", statute: "Minister of Justice Decision No. 526", language: "en" },
  { file: "the-implementing-regulations-of-the-enforcement-law-ar.txt", source: "Implementing Regulations of the Enforcement Law", statute: "Minister of Justice Decision No. 526", language: "ar" },
  { file: "implementing-regulations-of-appeal-procedures-en.txt", source: "Implementing Regulations of Appeal Procedures", statute: "Minister of Justice Decision No. 5134", language: "en" },
  { file: "implementing-regulations-of-appeal-procedures-ar.txt", source: "Implementing Regulations of Appeal Procedures", statute: "Minister of Justice Decision No. 5134", language: "ar" },
];

export async function main() {
  console.log(`Building Mizan vector store -- ${SOURCES.length} source files\n`);
  console.log(`Output: ${VECTOR_DB_PATH}\n`);

  // Ensure Ollama is reachable
  try {
    await ollama.list();
    console.log("Ollama connection confirmed.\n");
  } catch {
    console.error("Ollama is not running. Start Ollama and pull nomic-embed-text first:");
    console.error("  ollama pull nomic-embed-text");
    process.exit(1);
  }

  const lancedb = await import("@lancedb/lancedb");
  const db = await lancedb.connect(VECTOR_DB_PATH);

  let allRecords: Record<string, unknown>[] = [];
  let completed = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const source of SOURCES) {
    const filePath = path.resolve(`./data/sources/${source.file}`);
    const num = completed + skipped + failed.length + 1;

    if (!fs.existsSync(filePath)) {
      console.log(`[${num}/${SOURCES.length}] SKIP (not found) -- ${source.file}`);
      skipped++;
      continue;
    }

    console.log(`[${num}/${SOURCES.length}] ${source.source} (${source.language.toUpperCase()})`);

    try {
      const text = fs.readFileSync(filePath, "utf-8");
      const isLargeAnnotated = source.file.includes("annotated");
      const chunkSize = isLargeAnnotated ? 80 : source.language === "ar" ? 150 : CHUNK_SIZE;
      const chunks = chunkText(text, chunkSize);
      console.log(`  ${chunks.length} chunks`);

      const embeddings = await embedBatch(chunks);

      for (let i = 0; i < chunks.length; i++) {
        allRecords.push({
          id: `${source.file.replace(/[^a-z0-9]/gi, "-")}-${i}`,
          vector: embeddings[i],
          text: chunks[i],
          source: source.source,
          jurisdiction: "Saudi Arabia",
          statute: source.statute ?? "",
          section: "",
          language: source.language,
        });
      }

      completed++;
      console.log("  Done.\n");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED: ${msg}\n`);
      failed.push(source.file);
    }
  }

  if (allRecords.length === 0) {
    console.error("No records to write. Exiting.");
    process.exit(1);
  }

  console.log(`Writing ${allRecords.length} vectors to LanceDB...`);

  try {
    // Drop and recreate for a clean build
    await db.dropTable(TABLE_NAME);
  } catch {
    // Table didn't exist yet
  }

  await db.createTable(TABLE_NAME, allRecords);
  console.log("Vector store built successfully.\n");

  console.log("Summary:");
  console.log(`  Completed: ${completed}`);
  console.log(`  Skipped (not found): ${skipped}`);
  console.log(`  Failed: ${failed.length}`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`    - ${f}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
