const fs = require("fs");
const path = require("path");

/**
 * after-pack hook: make the bundled Ollama binary executable on macOS/Linux.
 * Runs after electron-builder packages the app but before DMG/NSIS creation.
 */
exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName } = context;
  if (electronPlatformName === "win32") return; // Windows doesn't need chmod

  const ollamaBin = path.join(appOutDir, "resources", "ollama", "ollama");
  if (fs.existsSync(ollamaBin)) {
    fs.chmodSync(ollamaBin, 0o755);
    console.log("  • set ollama binary +x");
  }
};
