import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Not available in desktop mode." }, { status: 410 });
}
export async function PATCH() {
  return NextResponse.json({ error: "Not available in desktop mode." }, { status: 410 });
}
