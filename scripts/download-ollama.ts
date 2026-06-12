/**
 * Downloads the Ollama binary for macOS and Windows into resources/ollama/.
 * Run before building the Electron app: npm run download:ollama
 */
import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import { createWriteStream } from "fs";
import { execSync } from "child_process";

const OLLAMA_VERSION = "0.30.7";

const tmp = os.tmpdir();

const ARCHIVES = [
  {
    url: `https://github.com/ollama/ollama/releases/download/v${OLLAMA_VERSION}/ollama-darwin.tgz`,
    archive: path.join(tmp, "ollama-darwin.tgz"),
    dest: "resources/ollama/mac/ollama",
    checkExists: (dest: string) => fs.existsSync(dest),
    extract: (archive: string, destDir: string) => {
      execSync(`tar -xzf "${archive}" -C "${destDir}"`);
      const bin = path.join(destDir, "ollama");
      if (!fs.existsSync(bin)) throw new Error(`ollama binary not found in tarball at ${bin}`);
    },
    platform: "macOS",
  },
  {
    url: `https://github.com/ollama/ollama/releases/download/v${OLLAMA_VERSION}/ollama-windows-amd64.zip`,
    archive: path.join(tmp, "ollama-windows.zip"),
    // dest points to the exe but we check the lib dir to detect full extract
    dest: "resources/ollama/win/ollama.exe",
    checkExists: (_dest: string) =>
      fs.existsSync("resources/ollama/win/ollama.exe") &&
      fs.existsSync("resources/ollama/win/lib/ollama/llama-server.exe"),
    extract: (archive: string, destDir: string) => {
      // Extract the full zip — Ollama needs llama-server.exe and the lib/ollama/ DLLs
      // alongside ollama.exe to run inference.
      if (process.platform === "win32") {
        execSync(`powershell -Command "Expand-Archive -Force '${archive}' '${destDir}'"`, { stdio: "inherit" });
      } else {
        execSync(`unzip -o "${archive}" -d "${destDir}"`, { stdio: "inherit" });
      }
      if (!fs.existsSync(path.join(destDir, "ollama.exe"))) {
        throw new Error(`ollama.exe not found after extraction in ${destDir}`);
      }
      if (!fs.existsSync(path.join(destDir, "lib", "ollama", "llama-server.exe"))) {
        throw new Error(`llama-server.exe not found after extraction — zip structure may have changed`);
      }
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
  for (const { url, archive, dest, checkExists, extract, platform } of ARCHIVES) {
    if (checkExists(dest)) {
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
