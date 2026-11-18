"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FRAGMENTS, TOTAL_FRAGMENTS, type FragmentId } from "@/lib/fragments";
import Finale from "./Finale";
import Photo from "./Photo";

type Message =
  | { kind: "chat"; role: "user" | "assistant"; content: string }
  | { kind: "unlock"; fragment: FragmentId };

const GREETING =
  "Hey Paloma! Ik ben Maarten, of toch een wazige versie van mij. Stel me vragen: hoe beter je me leert kennen, hoe scherper ik word. (English works too.)";

const SUGGESTIONS = ["Wat doe je in je vrije tijd?", "Wat bouw je graag?", "Wat zou je voor ons doen?"];

const titleOf = (id: FragmentId) => FRAGMENTS.find((f) => f.id === id)?.title ?? id;

export default function Game() {
  const [unlocked, setUnlocked] = useState<FragmentId[]>([]);
  const [ready, setReady] = useState(false);
  const [shownLevel, setShownLevel] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { kind: "chat", role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justUnlocked, setJustUnlocked] = useState<FragmentId | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const level = unlocked.length;
  const done = level >= TOTAL_FRAGMENTS;

  // Voortgang ophalen (bv. na herladen)
  useEffect(() => {
    fetch("/api/state", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { unlocked?: FragmentId[] }) => setUnlocked(data.unlocked ?? []))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!justUnlocked) return;
    const timer = setTimeout(() => setJustUnlocked(null), 2200);
    return () => clearTimeout(timer);
  }, [justUnlocked]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      setError(null);
      setInput("");

      const next: Message[] = [...messages, { kind: "chat", role: "user", content: question }];
      setMessages(next);
      setBusy(true);

      const history = next
        .filter((m): m is Extract<Message, { kind: "chat" }> => m.kind === "chat")
        .map(({ role, content }) => ({ role, content }));

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });
        const data = (await response.json()) as {
          reply?: string;
          newFragment?: FragmentId | null;
          unlocked?: FragmentId[];
          error?: string;
        };
        if (!response.ok || !data.reply) throw new Error(data.error ?? "Er liep iets mis.");

        const reply = data.reply;
        const fragment = data.newFragment ?? null;
        setMessages((current) => [
          ...current,
          { kind: "chat", role: "assistant", content: reply },
          ...(fragment ? [{ kind: "unlock", fragment } as const] : []),
        ]);
        if (data.unlocked) setUnlocked(data.unlocked);
        if (fragment) setJustUnlocked(fragment);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Er liep iets mis.");
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [busy, messages],
  );

  const reset = useCallback(async () => {
    await fetch("/api/state", { method: "DELETE" }).catch(() => {});
    setUnlocked([]);
    setMessages([{ kind: "chat", role: "assistant", content: GREETING }]);
    setError(null);
  }, []);

  const userMessages = messages.filter((m) => m.kind === "chat" && m.role === "user").length;

  return (
    <main className="game">
      <section className="left" aria-label="Voortgang">
        <header className="masthead">
          <p className="eyebrow">
            <span className="dot" aria-hidden /> Job Battle · voor Paloma
          </p>
          <h1 className="title">
            Unlock <span>Maarten</span>
          </h1>
          <p className="lede">Geen cv. Stel vragen, leer me kennen, en de foto wordt scherper.</p>
        </header>

        <Photo
          level={level}
          ready={ready}
          announce={justUnlocked ? titleOf(justUnlocked) : null}
          onShown={setShownLevel}
        />

        {done ? (
          <Finale onReset={reset} />
        ) : (
          <ol className="cards">
            {FRAGMENTS.map((f, i) => {
              const open = unlocked.includes(f.id);
              return (
                <li
                  key={f.id}
                  className={`card${open ? " is-open" : ""}${justUnlocked === f.id ? " is-new" : ""}`}
                >
                  <span className="card-number">{String(i + 1).padStart(2, "0")}</span>
                  {open ? (
                    <>
                      <span className="card-title">{f.title}</span>
                      <span className="card-text">{f.learned}</span>
                    </>
                  ) : (
                    <span className="card-hint">{f.hint}</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="chat" aria-label="Chat met Maarten">
        <header className="chat-head">
          <span className="avatar" aria-hidden>
            {shownLevel !== null && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/photo?level=${shownLevel}`} alt="" />
            )}
          </span>
          <span className="chat-who">
            <strong>Maarten</strong>
            <span className="chat-status">{busy ? "typt…" : "online"}</span>
          </span>
          <span className="chat-count">
            {level}/{TOTAL_FRAGMENTS} <span>fragmenten</span>
          </span>
        </header>

        <div className="chat-list" ref={listRef} aria-live="polite">
          {messages.map((m, i) =>
            m.kind === "unlock" ? (
              <p key={i} className="unlock-note">
                <span aria-hidden>✦</span> Fragment ontgrendeld: <strong>{titleOf(m.fragment)}</strong>
              </p>
            ) : (
              <p key={i} className={`bubble bubble-${m.role}`}>
                {m.content}
              </p>
            ),
          )}
          {busy && (
            <p className="bubble bubble-assistant typing" aria-label="Maarten typt">
              <span />
              <span />
              <span />
            </p>
          )}
        </div>

        {userMessages === 0 && (
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>
        )}

        {error && <p className="chat-error">{error}</p>}

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={done ? "Je kent me nu. Nog vragen?" : "Vraag me iets…"}
            maxLength={600}
            aria-label="Je vraag"
            disabled={busy}
          />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Stuur">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </section>
    </main>
  );
}
