import { execFileSync } from "child_process";
import http from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { app, utilityProcess, UtilityProcess } from "electron";

let serverProcess: UtilityProcess | null = null;

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

function waitForHttp(port: number, timeoutMs = 60_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    function tryRequest() {
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        res.resume();
        resolve();
      });
      req.setTimeout(1000);
      req.on("error", () => {
        if (Date.now() >= deadline) {
          reject(new Error("Next.js server did not start in time"));
        } else {
          setTimeout(tryRequest, 500);
        }
      });
      req.on("timeout", () => {
        req.destroy();
        if (Date.now() >= deadline) {
          reject(new Error("Next.js server did not start in time"));
        } else {
          setTimeout(tryRequest, 500);
        }
      });
    }

    tryRequest();
  });
}

function runPrismaMigrate(userData: string, appPath: string): void {
  const schemaPath = path.join(appPath, "prisma/schema.prisma");
  if (!fs.existsSync(schemaPath)) return;

  try {
    // Locate prisma CLI relative to the app
    const prismaBin = path.join(appPath, "node_modules/.bin/prisma");
    const cli = fs.existsSync(prismaBin) ? prismaBin : "prisma";
    execFileSync(cli, ["migrate", "deploy", "--schema", schemaPath], {
      env: {
        ...process.env,
        DATABASE_URL: `file:${path.join(userData, "mizan.db")}`,
      },
      stdio: "ignore",
    });
    console.log("[db] Migrations applied.");
  } catch {
    // migrate deploy may fail on first run if no migrations exist — try db push instead
    try {
      const prismaBin = path.join(appPath, "node_modules/.bin/prisma");
      const cli = fs.existsSync(prismaBin) ? prismaBin : "prisma";
      execFileSync(cli, ["db", "push", "--schema", schemaPath, "--accept-data-loss"], {
        env: {
          ...process.env,
          DATABASE_URL: `file:${path.join(userData, "mizan.db")}`,
        },
        stdio: "ignore",
      });
      console.log("[db] Schema pushed.");
    } catch (e) {
      console.error("[db] Failed to initialise database:", e);
    }
  }
}

export async function startNextServer(): Promise<number> {
  if (process.env.NODE_ENV === "development") {
    return 3000;
  }

  const port = await getAvailablePort();
  const appPath = app.getAppPath();
  const serverScript = path.join(appPath, ".next/standalone/server.js");
  const userData = app.getPath("userData");

  // Ensure the database schema exists before starting the server
  runPrismaMigrate(userData, appPath);

  serverProcess = utilityProcess.fork(serverScript, [], {
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      DATABASE_URL: `file:${path.join(userData, "mizan.db")}`,
      VECTOR_DB_PATH: path.join(userData, "vector-store"),
      OLLAMA_HOST: "http://127.0.0.1:11434",
    },
    stdio: "pipe",
  });

  serverProcess.stdout?.on("data", (d: Buffer) => console.log("[next]", d.toString().trim()));
  serverProcess.stderr?.on("data", (d: Buffer) => console.error("[next]", d.toString().trim()));
  serverProcess.on("exit", (code) => console.error(`[next] Process exited with code ${code}`));

  await waitForHttp(port);
  console.log(`[next] Server ready on port ${port}`);
  return port;
}

export async function stopNextServer(): Promise<void> {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

