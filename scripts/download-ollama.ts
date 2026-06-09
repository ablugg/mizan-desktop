/**
 * Downloads the Ollama binary for macOS and Windows into resources/ollama/.
 * Run before building the Electron app: npm run download:ollama
 */
import fs from "fs";
import path from "path";
import https from "https";
import { createWriteStream } from "fs";
import { execSync } from "child_process";

const OLLAMA_VERSION = "0.30.7";

const ARCHIVES = [
  {
    url: `https://github.com/ollama/ollama/releases/download/v${OLLAMA_VERSION}/ollama-darwin.tgz`,
    archive: "/tmp/ollama-darwin.tgz",
    dest: "resources/ollama/mac/ollama",
    extract: (archive: string, destDir: string) => {
      execSync(`tar -xzf "${archive}" -C "${destDir}"`);
      // Binary is named 'ollama' inside the tarball
      const bin = path.join(destDir, "ollama");
      if (!fs.existsSync(bin)) throw new Error(`ollama binary not found in tarball at ${bin}`);
    },
    platform: "macOS",
  },
  {
    url: `https://github.com/ollama/ollama/releases/download/v${OLLAMA_VERSION}/ollama-windows-amd64.zip`,
    archive: "/tmp/ollama-windows.zip",
    dest: "resources/ollama/win/ollama.exe",
    extract: (archive: string, destDir: string) => {
      execSync(`unzip -o "${archive}" ollama.exe -d "${destDir}"`);
    },
    platform: "Windows",
  },
];

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);

    function get(url: string) {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          get(res.headers.location!);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const total = parseInt(res.headers["content-length"] ?? "0", 10);
        let downloaded = 0;
        res.on("data", (chunk: Buffer) => {
          downloaded += chunk.length;
          if (total > 0) {
            const pct = ((downloaded / total) * 100).toFixed(1);
            process.stdout.write(`\r  ${pct}% (${(downloaded / 1_048_576).toFixed(1)} MB)`);
          }
        });
        res.pipe(file);
        file.on("finish", () => {
          process.stdout.write("\n");
          file.close();
          resolve();
        });
      }).on("error", reject);
    }

    file.on("error", reject);
    get(url);
  });
}

async function main() {
  for (const { url, archive, dest, extract, platform } of ARCHIVES) {
    if (fs.existsSync(dest)) {
      console.log(`[skip] ${platform} binary already exists at ${dest}`);
      continue;
    }
    const destDir = path.dirname(dest);
    fs.mkdirSync(destDir, { recursive: true });

    console.log(`Downloading Ollama ${OLLAMA_VERSION} for ${platform}...`);
    await download(url, archive);

    console.log(`  Extracting...`);
    extract(archive, destDir);

    fs.chmodSync(dest, 0o755);
    console.log(`  Saved to ${dest}`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
