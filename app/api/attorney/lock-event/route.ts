import { NextResponse } from "next/server";

// Desktop: lock events are stored locally in memory by the client.
// This stub keeps compatibility with the existing lockdown UI.
export async function POST() {
  return NextResponse.json({ ok: true });
}
