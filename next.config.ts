import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["mammoth", "pdf2json", "@lancedb/lancedb", "ollama", "unzipper"],
};

export default nextConfig;
