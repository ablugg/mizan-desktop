import { NextResponse } from "next/server";

// Desktop: no remote login tracking.
export async function POST() {
  return NextResponse.json({ ok: true });
}
