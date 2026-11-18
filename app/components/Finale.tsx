"use client";

import { useState } from "react";
import { FRAGMENTS, TOTAL_FRAGMENTS } from "@/lib/fragments";

const EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";
const SUBJECT = "Let's meet (via Unlock Maarten)";
const SITE = "https://maartencoppens.be";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fontFamily(variable: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

/** Tekent het deelkaartje (1080 × 1350, Instagram-formaat) en downloadt het. */
async function downloadCard() {
  await document.fonts.ready;
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const display = fontFamily("--font-display", "Impact, sans-serif");
  const body = fontFamily("--font-body", "system-ui, sans-serif");
  const purple = "#b57bff";

  ctx.fillStyle = "#0d0b10";
  ctx.fillRect(0, 0, W, H);

  // Foto bovenaan, "cover"-uitsnede
  const photo = await loadImage(`/api/photo?level=${TOTAL_FRAGMENTS}`);
  const boxH = 700;
  const scale = Math.max(W / photo.width, boxH / photo.height);
  const sw = W / scale;
  const sh = boxH / scale;
  ctx.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) / 3, sw, sh, 0, 0, W, boxH);
  const fade = ctx.createLinearGradient(0, boxH - 260, 0, boxH);
  fade.addColorStop(0, "rgba(13,11,16,0)");
  fade.addColorStop(1, "rgba(13,11,16,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, boxH - 260, W, 260);

  ctx.fillStyle = purple;
  ctx.font = `500 30px ${body}`;
  ctx.fillText("UNLOCK MAARTEN · 100%", 72, 690);

  ctx.fillStyle = "#f4f1f8";
  ctx.font = `92px ${display}`;
  ctx.fillText("WAT JE OVER", 72, 800);
  ctx.fillText("MAARTEN LEERDE", 72, 896);

  ctx.font = `400 34px ${body}`;
  FRAGMENTS.forEach((f, i) => {
    const y = 980 + i * 52;
    ctx.fillStyle = purple;
    ctx.fillRect(72, y - 14, 14, 14);
    ctx.fillStyle = "#e7e2ee";
    ctx.fillText(f.learned, 108, y);
  });

  ctx.fillStyle = "#8f879b";
  ctx.font = `400 28px ${body}`;
  ctx.fillText("maartencoppens.be", 72, H - 56);

  const link = document.createElement("a");
  link.download = "wat-je-over-maarten-leerde.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export default function Finale({ onReset }: { onReset: () => void }) {
  const [making, setMaking] = useState(false);

  return (
    <div className="finale">
      <p className="finale-title">Je kent me nu.</p>
      <p className="finale-text">Zullen we afspreken? Dan vertel ik je de rest in het echt.</p>
      <div className="finale-actions">
        {EMAIL && (
          <a className="btn btn-primary" href={`mailto:${EMAIL}?subject=${encodeURIComponent(SUBJECT)}`}>
            Let&apos;s meet
          </a>
        )}
        <button
          type="button"
          className="btn"
          disabled={making}
          onClick={async () => {
            setMaking(true);
            try {
              await downloadCard();
            } finally {
              setMaking(false);
            }
          }}
        >
          {making ? "Even tekenen…" : "Download je kaartje"}
        </button>
        <a className="btn" href={SITE} target="_blank" rel="noreferrer">
          maartencoppens.be
        </a>
      </div>
      <button type="button" className="finale-reset" onClick={onReset}>
        Opnieuw beginnen
      </button>
    </div>
  );
}
