import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";
import unzipper from "unzipper";
import { resetConnection } from "@/lib/rag";

const VECTOR_DB_PATH =
  process.env.VECTOR_DB_PATH ?? path.join(process.cwd(), "data/vector-store");

const TABLE_DIR = path.join(VECTOR_DB_PATH, "legal_chunks.lance");

async function getLatestReleaseAssetUrl(): Promise<string> {
  const repo = process.env.GITHUB_LAWS_REPO;
  if (!repo) throw new Error("GITHUB_LAWS_REPO is not configured");

  const res = await fetch(
    `https://api.github.com/repos/${repo}/releases/latest`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mizan-app",
      },
    }
  );

  if (!res.ok) throw new Error(`Could not fetch latest release (${res.status})`);

  const release = await res.json() as { assets: { name: string; browser_download_url: string }[] };
  const asset = release.assets.find((a) => a.name === "legal_chunks.lance.zip");
  if (!asset) throw new Error("No legal_chunks.lance.zip asset found in latest release");

  return asset.browser_download_url;
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  if (!res.body) throw new Error("No response body");

  const writer = fs.createWriteStream(dest);
  const reader = res.body.getReader();

  await new Promise<void>((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);

    async function pump() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { writer.end(); break; }
          writer.write(value);
        }
      } catch (err) {
        writer.destroy(err as Error);
        reject(err);
      }
    }
    pump();
  });
}

async function extractZip(zipPath: string, destDir: string): Promise<void> {
  await fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: destDir }))
    .promise();
}

export async function POST() {
  try {
    // Step 1: get download URL from latest GitHub release
    const assetUrl = await getLatestReleaseAssetUrl();

    // Step 2: download zip to temp file
    const tmpZip = path.join(os.tmpdir(), `mizan-laws-sync-${Date.now()}.zip`);
    await downloadFile(assetUrl, tmpZip);

    // Step 3: remove old table directory if it exists
    if (fs.existsSync(TABLE_DIR)) {
      fs.rmSync(TABLE_DIR, { recursive: true, force: true });
    }

    // Step 4: extract into VECTOR_DB_PATH (zip contains legal_chunks.lance/ at root)
    fs.mkdirSync(VECTOR_DB_PATH, { recursive: true });
    await extractZip(tmpZip, VECTOR_DB_PATH);

    // Step 5: reset LanceDB connection so next query uses the new data
    resetConnection();

    fs.unlinkSync(tmpZip);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Attorney sync failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
