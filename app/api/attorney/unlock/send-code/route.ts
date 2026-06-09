import { NextResponse } from "next/server";

// Desktop: no email-based unlock. The app only uses the password/PIN flow.
export async function POST() {
  return NextResponse.json({ ok: false, error: "Email unlock is not available in desktop mode. Use your PIN instead." });
}
