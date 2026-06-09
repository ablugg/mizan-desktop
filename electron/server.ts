import { spawn, ChildProcess } from "child_process";
import net from "net";
import path from "path";
import { app } from "electron";

let serverProcess: ChildProcess | null = null;

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as net.AddressInfo;
      server.close(() => resolve(addr.port));
    });
    server.on("error", reject);
  });
}

function waitForPort(port: number, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    function tryConnect() {
      const socket = net.createConnection({ port, host: "127.0.0.1" });
      socket.on("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error("Next.js server did not start in time"));
        } else {
          setTimeout(tryConnect, 250);
        }
      });
    }

    tryConnect();
  });
}

export async function startNextServer(): Promise<number> {
  if (process.env.NODE_ENV === "development") {
    // Dev server is already running via `next dev`
    return 3000;
  }

  const port = await getAvailablePort();
  const serverScript = path.join(app.getAppPath(), ".next/standalone/server.js");
  const userData = app.getPath("userData");

  serverProcess = spawn(process.execPath, [serverScript], {
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      DATABASE_URL: `file:${path.join(userData, "mizan.db")}`,
      VECTOR_DB_PATH: path.join(userData, "vector-store"),
      OLLAMA_HOST: "http://127.0.0.1:11434",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout?.on("data", (d) => console.log("[next]", d.toString().trim()));
  serverProcess.stderr?.on("data", (d) => console.error("[next]", d.toString().trim()));

  serverProcess.on("error", (err) => console.error("[next] Process error:", err));

  await waitForPort(port);
  console.log(`[next] Server ready on port ${port}`);
  return port;
}

export async function stopNextServer(): Promise<void> {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}
