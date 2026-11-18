"use client";

import { useEffect, useState } from "react";
import { TOTAL_FRAGMENTS } from "@/lib/fragments";

type Props = {
  level: number;
  ready: boolean;
  /** Titel van het fragment dat net ontgrendeld werd (toont een melding op de foto). */
  announce: string | null;
  onShown?: (level: number) => void;
};

/**
 * De foto op het verdiende niveau. Een nieuw niveau wordt eerst volledig geladen
 * en pas dan als laag bovenop gelegd: nooit een half geladen of kapotte afbeelding.
 */
export default function Photo({ level, ready, announce, onShown }: Props) {
  const [layers, setLayers] = useState<number[]>([]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setLayers((current) => {
        if (current.at(-1) === level) return current;
        // Bij een reset (lager niveau) opnieuw beginnen
        const top = current.at(-1) ?? -1;
        return level < top ? [level] : [...current.slice(-1), level];
      });
      onShown?.(level);
    };
    img.src = `/api/photo?level=${level}`;
    return () => {
      cancelled = true;
    };
  }, [level, ready, onShown]);

  const percent = Math.round((level / TOTAL_FRAGMENTS) * 100);

  return (
    <div className={`photo${announce ? " is-glowing" : ""}${layers.length ? "" : " is-loading"}`}>
      {layers.map((l) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={l}
          src={`/api/photo?level=${l}`}
          alt={l === TOTAL_FRAGMENTS ? "Maarten Coppens" : "Een wazige foto van Maarten"}
        />
      ))}

      <span className="photo-level">
        {level === TOTAL_FRAGMENTS ? "Scherp" : `Niveau ${level} / ${TOTAL_FRAGMENTS}`}
      </span>

      {announce && (
        <span key={announce} className="photo-announce">
          + {announce}
        </span>
      )}

      <div className="photo-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="photo-meter-top">
          <span className="photo-percent">{percent}%</span>
          <span className="photo-caption">van Maarten ontgrendeld</span>
        </div>
        <div className="meter-track">
          <div className="meter-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}
