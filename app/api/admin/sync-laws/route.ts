import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Archiver } = require("archiver") as { Archiver: new (format: string, opts: object) => import("archiver").Archiver };

const VECTOR_DB_PATH =
  process.env.VECTOR_DB_PATH ?? path.join(process.cwd(), "data/vector-store");

const TABLE_DIR = path.join(VECTOR_DB_PATH, "legal_chunks.lance");

function zipDirectory(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = new Archiver("zip", { zlib: { level: 6 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDir, "legal_chunks.lance");
    archive.finalize();
  });
}

async function uploadToGitHub(zipPath: string): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_LAWS_REPO; // e.g. "muhammadablugg/mizan-laws"
  if (!token || !repo) throw new Error("GITHUB_TOKEN and GITHUB_LAWS_REPO must be set");

  const tag = `laws-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "mizan-app",
  };

  // Create the release
  const createRes = await fetch(`https://api.github.com/repos/${repo}/releases`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      tag_name: tag,
      name: `Law Library — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
      body: "Automated law library update from Mizan admin sync.",
      draft: false,
      prerelease: false,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`GitHub release creation failed: ${err}`);
  }

  const release = await createRes.json() as { id: number; upload_url: string };

  // Upload the zip asset
  const zipBuffer = fs.readFileSync(zipPath);
  const uploadUrl = `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=legal_chunks.lance.zip`;

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/zip",
      "User-Agent": "mizan-app",
    },
    body: zipBuffer,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`GitHub asset upload failed: ${err}`);
  }

  const asset = await uploadRes.json() as { browser_download_url: string };
  return asset.browser_download_url;
}

export async function POST() {
  try {
    // Step 1: rebuild the vector store
    const { main } = await import("@/data/ingestion/build-vectors");
    await main();

    // Step 2: zip legal_chunks.lance
    if (!fs.existsSync(TABLE_DIR)) {
      return NextResponse.json({ error: "Vector store not found after rebuild" }, { status: 500 });
    }

    const tmpZip = path.join(os.tmpdir(), `mizan-laws-${Date.now()}.zip`);
    await zipDirectory(TABLE_DIR, tmpZip);

    // Step 3: upload to GitHub Releases
    const downloadUrl = await uploadToGitHub(tmpZip);
    fs.unlinkSync(tmpZip);

    return NextResponse.json({ ok: true, downloadUrl });
  } catch (err) {
    console.error("Sync laws failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
