const fs = require("fs");
const path = require("path");

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * after-pack hook: runs after electron-builder packages the app but before DMG/NSIS creation.
 *
 * Fixes two issues electron-builder causes by default:
 * 1. Dotfolders (e.g. .prisma) are excluded from the packaged app by electron-builder's
 *    glob engine. We manually copy the Prisma query engine binary here.
 * 2. The bundled Ollama binary needs +x on macOS/Linux.
 */
exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName } = context;

  // Resolve the inner app directory (where node_modules lives at runtime)
  let appDir;
  if (electronPlatformName === "darwin") {
    // Find the .app bundle inside appOutDir
    const entry = fs.readdirSync(appOutDir).find((f) => f.endsWith(".app"));
    if (!entry) {
      console.warn("  [after-pack] Could not find .app bundle in", appOutDir);
      return;
    }
    appDir = path.join(appOutDir, entry, "Contents", "Resources", "app");
  } else {
    appDir = path.join(appOutDir, "resources", "app");
  }

  // 1. Inject .prisma/client (Prisma query engine) — excluded by electron-builder dotfile rules
  const srcPrisma = path.join(__dirname, "..", "node_modules", ".prisma");
  const destPrisma = path.join(appDir, "node_modules", ".prisma");
  if (fs.existsSync(srcPrisma)) {
    copyDirSync(srcPrisma, destPrisma);
    console.log("  • injected .prisma/client into packaged app");
  } else {
    console.warn("  [after-pack] .prisma not found at", srcPrisma);
  }

  // 2. Make the bundled Ollama binary executable on macOS/Linux
  if (electronPlatformName !== "win32") {
    const ollamaBin = path.join(appOutDir, "resources", "ollama", "ollama");
    if (fs.existsSync(ollamaBin)) {
      fs.chmodSync(ollamaBin, 0o755);
      console.log("  • set ollama binary +x");
    }
  }
};
