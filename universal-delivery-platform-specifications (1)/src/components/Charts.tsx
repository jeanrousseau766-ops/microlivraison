"use client";

import { useId, useState } from "react";

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C ${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}

export function AreaChart({
  values,
  labels,
  color = "#E4572E",
  height = 150,
  format = (v: number) => String(v),
}: {
  values: number[];
  labels?: string[];
  color?: string;
  height?: number;
  format?: (v: number) => string;
}) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 200;
  const pad = 14;
  const max = Math.max(1, ...values);
  const pts: [number, number][] = values.map((v, i) => [
    pad + (i * (W - pad * 2)) / Math.max(1, values.length - 1),
    H - pad - (v / max) * (H - pad * 2),
  ]);
  const line = smoothPath(pts);
  const area = line ? `${line} L ${pts[pts.length - 1][0]},${H - 2} L ${pts[0][0]},${H - 2} Z` : "";
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          let bd = Infinity;
          pts.forEach((p, i) => {
            const d = Math.abs(p[0] - x);
            if (d < bd) {
              bd = d;
              best = i;
            }
          });
          setHover(best);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={H * f} y2={H * f} stroke="#1B2237" strokeOpacity="0.07" strokeDasharray="4 6" />
        ))}
        {area && <path d={area} fill={`url(#g${id})`} />}
        {line && <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />}
        {hover !== null && pts[hover] && (
          <>
            <line x1={pts[hover][0]} x2={pts[hover][0]} y1={pad} y2={H - pad} stroke={color} strokeOpacity="0.4" strokeDasharray="3 4" />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r="6" fill={color} stroke="#FFFCF3" strokeWidth="3" />
          </>
        )}
      </svg>
      {hover !== null && values[hover] !== undefined && (
        <div
          className="pointer-events-none absolute -top-1 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-extrabold text-cream shadow-lg"
          style={{ left: `${(pts[hover][0] / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          {format(values[hover])}
          {labels?.[hover] && <span className="ml-1.5 opacity-70">{labels[hover]}</span>}
        </div>
      )}
      {labels && (
        <div className="mt-1 flex justify-between text-[10px] font-bold text-ink-soft">
          <span>{labels[0]}</span>
          <span>{labels[Math.floor(labels.length / 2)]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}

export function Bars({
  values,
  labels,
  color = "#2667FF",
  height = 130,
  format = (v: number) => String(v),
}: {
  values: number[];
  labels?: string[];
  color?: string;
  height?: number;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {values.map((v, i) => (
          <div key={i} className="group relative flex-1 rounded-t-md transition-all hover:brightness-110" style={{ height: `${Math.max(3, (v / max) * 100)}%`, background: `linear-gradient(180deg, ${color}, ${color}88)` }} title={`${labels?.[i] ?? i} : ${format(v)}`}>
            <div className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-extrabold text-cream opacity-0 transition group-hover:opacity-100 whitespace-nowrap">
              {format(v)}
            </div>
          </div>
        ))}
      </div>
      {labels && (
        <div className="mt-1 flex justify-between text-[10px] font-bold text-ink-soft">
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}

export function Donut({
  parts,
  size = 150,
  centerLabel,
  centerSub,
}: {
  parts: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = Math.max(1, parts.reduce((s, p) => s + p.value, 0));
  const R = 42;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 110 110" style={{ width: size, height: size }} className="shrink-0 -rotate-90">
        <circle cx="55" cy="55" r={R} fill="none" stroke="#1B2237" strokeOpacity="0.07" strokeWidth="13" />
        {parts.map((p, i) => {
          const frac = p.value / total;
          const dash = `${frac * C} ${C}`;
          const offset = -acc * C;
          acc += frac;
          return (
            <circle key={i} cx="55" cy="55" r={R} fill="none" stroke={p.color} strokeWidth="13" strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="butt">
              <title>{`${p.label} : ${Math.round(frac * 100)} %`}</title>
            </circle>
          );
        })}
        {centerLabel && (
          <g className="rotate-90" style={{ transformOrigin: "55px 55px" }}>
            <text x="55" y="53" textAnchor="middle" fontSize="14" fontWeight="800" fill="#1B2237">
              {centerLabel}
            </text>
            <text x="55" y="67" textAnchor="middle" fontSize="8" fontWeight="700" fill="#55607A">
              {centerSub}
            </text>
          </g>
        )}
      </svg>
      <div className="space-y-1.5">
        {parts.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs font-bold">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            <span className="text-ink-soft">{p.label}</span>
            <span className="tabular-nums">{Math.round((p.value / total) * 100)} %</span>
          </div>
        ))}
      </div>
    </div>
  );
}
