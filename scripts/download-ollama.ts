/**
 * Downloads the Ollama binary for macOS and Windows into resources/ollama/.
 * Run before building the Electron app: npm run download:ollama
 */
import fs from "fs";
import path from "path";
import https from "https";
import { createWriteStream } from "fs";

const OLLAMA_VERSION = "0.5.13";

const BINARIES = [
  {
    url: `https://github.com/ollama/ollama/releases/download/v${OLLAMA_VERSION}/ollama-darwin`,
    dest: "resources/ollama/mac/ollama",
    platform: "macOS",
  },
  {
    url: `https://github.com/ollama/ollama/releases/download/v${OLLAMA_VERSION}/ollama-windows-amd64.exe`,
    dest: "resources/ollama/win/ollama.exe",
    platform: "Windows",
  },
];

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
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
        res.on("end", () => {
          process.stdout.write("\n");
          resolve();
        });
      }).on("error", reject);
    }

    file.on("error", reject);
    get(url);
  });
}

async function main() {
  for (const { url, dest, platform } of BINARIES) {
    if (fs.existsSync(dest)) {
      console.log(`[skip] ${platform} binary already exists at ${dest}`);
      continue;
    }
    console.log(`Downloading Ollama ${OLLAMA_VERSION} for ${platform}...`);
    await download(url, dest);
    fs.chmodSync(dest, 0o755);
    console.log(`  Saved to ${dest}`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
