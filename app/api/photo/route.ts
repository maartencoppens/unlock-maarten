import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { TOTAL_FRAGMENTS } from "@/lib/fragments";
import { readState } from "@/lib/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Geeft de foto terug op het gevraagde blur-niveau, maar nooit scherper dan
 * wat deze bezoeker verdiend heeft. De scherpe foto staat dus niet publiek online.
 */
export async function GET(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get("level") ?? "0");
  if (!Number.isInteger(requested) || requested < 0 || requested > TOTAL_FRAGMENTS) {
    return NextResponse.json({ error: "Ongeldig niveau." }, { status: 400 });
  }

  if (requested > readState(request).unlocked.length) {
    return NextResponse.json({ error: "Nog niet verdiend." }, { status: 403 });
  }

  try {
    const file = await readFile(path.join(process.cwd(), "private", "photo", `level-${requested}.jpg`));
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Foto ontbreekt: run `npm run photo`." }, { status: 404 });
  }
}
