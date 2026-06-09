import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LOCAL_USER_ID } from "@/lib/local-auth";

export async function GET() {
  const usages = await db.attorneyToolUsage.findMany({
    where: { userId: LOCAL_USER_ID },
    select: { tool: true, usedAt: true },
    orderBy: { usedAt: "asc" },
  });

  const toolCounts: Record<string, number> = {};
  for (const u of usages) {
    toolCounts[u.tool] = (toolCounts[u.tool] ?? 0) + 1;
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const daily: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    daily.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  const dateIndex = Object.fromEntries(daily.map((d, i) => [d.date, i]));
  for (const u of usages) {
    const key = u.usedAt.toISOString().slice(0, 10);
    if (key in dateIndex) daily[dateIndex[key]].count++;
  }

  const totalCount = usages.length;

  return NextResponse.json({
    toolCounts,
    daily,
    enclaveCount: 0,
    totalCount,
    loginEvents: [],
    lockEvents: [],
  });
}
