import { NextRequest, NextResponse } from "next/server";

// No auth middleware needed -- desktop-only app.
export function proxy(_req: NextRequest) {
  return NextResponse.next();
}
