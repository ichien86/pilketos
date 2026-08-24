import { NextResponse } from "next/server";
import { getAllFase } from "@/lib/fase-gate";

export const dynamic = "force-dynamic";

export async function GET() {
  const all = await getAllFase();
  return NextResponse.json(all);
}
