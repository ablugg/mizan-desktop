import { NextResponse } from "next/server";

// Desktop: no OTP flow. Use the password/PIN endpoint instead.
export async function POST() {
  return NextResponse.json({ ok: false, error: "Code unlock is not available in desktop mode. Use your PIN instead." });
}
