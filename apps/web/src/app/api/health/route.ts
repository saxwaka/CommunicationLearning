import { NextResponse } from "next/server";
import { speech } from "@/lib/speech";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await speech.health());
}
