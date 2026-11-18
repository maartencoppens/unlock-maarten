import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { isFragmentId, type FragmentId } from "./fragments";

// De voortgang zit in een ondertekende, httpOnly cookie: geen database nodig.
// De bezoeker kan ze lezen noch vervalsen, want de handtekening (HMAC) kent alleen de server.

export type GameState = {
  unlocked: FragmentId[];
  /** Berichten op rij zonder unlock: na 3 krijgt de bezoeker een hint. */
  misses: number;
  /** Totaal aantal berichten (voor de limiet per bezoeker). */
  messages: number;
};

const COOKIE = "um_state";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.SESSION_SECRET || process.env.ASK_API_KEY;
  if (!value && process.env.NODE_ENV === "production") {
    console.warn("SESSION_SECRET ontbreekt: zet die in je environment variables.");
  }
  return value || "alleen-voor-lokaal";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function emptyState(): GameState {
  return { unlocked: [], misses: 0, messages: 0 };
}

export function readState(request: Request): GameState {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  const [payload, signature] = (match?.[1] ?? "").split(".");
  if (!payload || !signature) return emptyState();

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return emptyState();

  try {
    const raw = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<GameState>;
    const unlocked = Array.isArray(raw.unlocked) ? raw.unlocked.filter(isFragmentId) : [];
    return {
      unlocked: [...new Set(unlocked)],
      misses: typeof raw.misses === "number" ? raw.misses : 0,
      messages: typeof raw.messages === "number" ? raw.messages : 0,
    };
  } catch {
    return emptyState();
  }
}

export function writeState<T extends NextResponse>(response: T, state: GameState): T {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  response.cookies.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
  return response;
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
