import { NextResponse } from "next/server";

export function errorJson(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
