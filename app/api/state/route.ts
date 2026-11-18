import { NextResponse } from "next/server";
import { emptyState, readState, writeState } from "@/lib/state";

export const dynamic = "force-dynamic";

/** Huidige voortgang van deze bezoeker. */
export async function GET(request: Request) {
  const state = readState(request);
  return NextResponse.json({ unlocked: state.unlocked, level: state.unlocked.length });
}

/** Opnieuw beginnen (handig voor je demo-opname). */
export async function DELETE(request: Request) {
  const state = readState(request);
  // Het aantal berichten blijft staan, zodat resetten de limiet niet omzeilt
  return writeState(NextResponse.json({ unlocked: [], level: 0 }), {
    ...emptyState(),
    messages: state.messages,
  });
}
