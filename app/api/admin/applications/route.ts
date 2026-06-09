import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Not available in desktop mode." }, { status: 410 });
}
export async function POST() {
  return NextResponse.json({ error: "Not available in desktop mode." }, { status: 410 });
}
