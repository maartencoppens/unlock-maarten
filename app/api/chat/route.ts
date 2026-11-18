import { NextResponse } from "next/server";
import { pickUnlock } from "@/lib/fragments";
import { askModel, isModelConfigured, type ChatMessage } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompt";
import { getRequestIp, readState, writeState } from "@/lib/state";
import { incrementCounter } from "@/lib/store";

// Limieten: pas aan naar je API-budget
const PER_IP_PER_MINUTE = 15;
const PER_VISITOR_TOTAL = 40;
const GLOBAL_PER_DAY = 400;
const MAX_HISTORY = 12;
const MAX_CHARS = 600;
const HINT_AFTER_MISSES = 3;

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  if (!isModelConfigured()) {
    return fail(503, "De chat is nog niet geconfigureerd (ASK_API_URL ontbreekt).");
  }

  const ip = getRequestIp(request);
  const day = new Date().toISOString().slice(0, 10);
  const [perIp, perDay] = await Promise.all([
    incrementCounter(`ip:${ip}`, 60),
    incrementCounter(`day:${day}`, 60 * 60 * 26),
  ]);
  if (perIp > PER_IP_PER_MINUTE) {
    return fail(429, "Rustig aan, even ademhalen. Probeer het over een minuutje opnieuw.");
  }
  if (perDay > GLOBAL_PER_DAY) {
    return fail(429, "Ik heb vandaag al veel gepraat. Stuur me gerust een mail!");
  }

  let body: { messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Ongeldig verzoek.");
  }

  // Alleen user/assistant-berichten, ingekort: de systeemprompt komt altijd van de server
  const history: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        typeof m === "object" &&
        ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
        typeof (m as ChatMessage).content === "string",
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  const lastUser = history.at(-1);
  if (!lastUser || lastUser.role !== "user" || !lastUser.content.trim()) {
    return fail(400, "Stel me een vraag.");
  }

  const state = readState(request);
  if (state.messages >= PER_VISITOR_TOTAL) {
    return fail(429, "We hebben al veel gepraat! Laten we afspreken in het echt.");
  }

  let answer;
  try {
    answer = await askModel(
      buildSystemPrompt(state.unlocked, state.misses >= HINT_AFTER_MISSES),
      history,
      request.signal,
    );
  } catch {
    return fail(502, "Ik ben even offline. Probeer het zo meteen opnieuw.");
  }

  // De server beslist wat er ontgrendelt, niet het model
  const newFragment = pickUnlock(answer.unlocked, state.unlocked, lastUser.content);
  const next = {
    unlocked: newFragment ? [...state.unlocked, newFragment] : state.unlocked,
    misses: newFragment ? 0 : state.misses + 1,
    messages: state.messages + 1,
  };

  return writeState(
    NextResponse.json({
      reply: answer.reply,
      newFragment,
      unlocked: next.unlocked,
      level: next.unlocked.length,
    }),
    next,
  );
}
