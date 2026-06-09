import { NextResponse } from "next/server";

// Desktop: no enclave.
export async function GET() {
  return NextResponse.json({ error: "Enclave not available in desktop mode." }, { status: 410 });
}
