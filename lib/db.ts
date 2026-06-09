import { PrismaClient } from "@prisma/client";
import path from "path";

// In Electron production the DATABASE_URL is injected by the main process.
// In dev it falls back to a local SQLite file.
function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const dbPath = path.join(process.cwd(), "mizan-dev.db");
  return `file:${dbPath}`;
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = getDatabaseUrl();
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Ensures the local user record exists on first run.
// Called once at startup from the setup API route.
export async function ensureLocalUser(): Promise<void> {
  const LOCAL_USER_ID = "local";
  const existing = await db.user.findUnique({ where: { id: LOCAL_USER_ID } });
  if (!existing) {
    await db.user.create({
      data: {
        id: LOCAL_USER_ID,
        email: "local@mizan.app",
        name: "Local User",
      },
    });
  }
}