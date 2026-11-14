"use client";
import { useEffect, useState } from "react";
import { LANE_CUTS } from "@/lib/api";
import { CountUp } from "./CountUp";

const MAX = 0.3; // dial scale 0–30%

/**
 * Semi-circle risk dial with the two lane cut-offs as zones.
 * Not mirrored in RTL (numeric scale), so the SVG is forced to dir=ltr.
 * The number and label are always shown as text beside the graphic (chart a11y rule).
 */
export function Dial({ value, label, tone = "light", width = 300 }: { value: number; label: string; tone?: "light" | "ink"; width?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setShown(value)); return () => cancelAnimationFrame(id); }, [value]);

  const sw = 14, r = width / 2 - sw, cx = width / 2, cy = r + sw;
  // rounded so server and browser render identical path strings (no hydration mismatch)
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const pt = (v: number, rr = r) => { const t = Math.PI * (1 - Math.min(v, MAX) / MAX); return [r2(cx + rr * Math.cos(t)), r2(cy - rr * Math.sin(t))] as const; };
  const arc = (a: number, b: number) => { const [x0, y0] = pt(a), [x1, y1] = pt(b); return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`; };
  const gap = 0.0025;
  const angle = -90 + (180 * Math.min(shown, MAX)) / MAX; // needle rotation, -90 = 0%
  const ink = tone === "ink";
  const zones = ink ? ["#6CE9A6", "#8FB4FF", "#FDA29B"] : ["var(--fast)", "var(--standard)", "var(--strict)"];

  return (
    <figure className="relative mx-auto" style={{ width }} dir="ltr" aria-label={`${label}: ${(value * 100).toFixed(1)}%`}>
      <svg viewBox={`0 0 ${width} ${cy + 12}`} width={width} height={cy + 12} aria-hidden>
        <path d={arc(0, MAX)} stroke={ink ? "#24304A" : "var(--muted)"} strokeWidth={sw} fill="none" />
        <path d={arc(0, LANE_CUTS.fast - gap)} stroke={zones[0]} strokeWidth={sw} fill="none" />
        <path d={arc(LANE_CUTS.fast + gap, LANE_CUTS.strict - gap)} stroke={zones[1]} strokeWidth={sw} fill="none" opacity={0.9} />
        <path d={arc(LANE_CUTS.strict + gap, MAX)} stroke={zones[2]} strokeWidth={sw} fill="none" />
        {/* soft glow under the needle tip */}
        <circle cx={pt(shown, r)[0]} cy={pt(shown, r)[1]} r={11} fill={ink ? "#7CC8CF" : "var(--accent)"} opacity={0.25} style={{ transition: "all 900ms cubic-bezier(.2,.7,.2,1)" }} />
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: "transform 900ms cubic-bezier(.2,.7,.2,1)" }}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - r + 26} stroke={ink ? "#F1F5F9" : "var(--foreground)"} strokeWidth={3} strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r={8} fill={ink ? "#F1F5F9" : "var(--foreground)"} />
        <circle cx={cx} cy={cy} r={3} fill={ink ? "#131D33" : "var(--card)"} />
      </svg>
      <div className="flex justify-between px-1 text-xs text-on-ink-muted" style={{ color: ink ? undefined : "var(--muted-foreground)" }}>
        <span>0%</span><span>30%+</span>
      </div>
      <figcaption className="mt-2 text-center">
        <CountUp value={value * 100} decimals={1} suffix="%" className={`block text-5xl font-semibold tracking-tight tabular ${ink ? "text-on-ink" : "text-foreground"}`} />
        <span className={`text-sm ${ink ? "text-on-ink-muted" : "text-muted-foreground"}`}>{label}</span>
      </figcaption>
    </figure>
  );
}
