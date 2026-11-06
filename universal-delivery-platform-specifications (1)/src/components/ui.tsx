"use client";

import { ReactNode, useEffect } from "react";
import { OrderStatus, statusLabel } from "@/lib/util";
import { useToasts } from "@/lib/client";

export function Badge({
  children,
  tone = "ink",
  className = "",
}: {
  children: ReactNode;
  tone?: "ink" | "vermillon" | "leaf" | "river" | "ambre" | "danger" | "grape" | "rose" | "soft";
  className?: string;
}) {
  const tones: Record<string, string> = {
    ink: "bg-ink text-cream",
    vermillon: "bg-vermillon/12 text-vermillon-deep",
    leaf: "bg-leaf/12 text-leaf",
    river: "bg-river/12 text-river",
    ambre: "bg-ambre/15 text-[#8a5a00]",
    danger: "bg-danger/12 text-danger",
    grape: "bg-grape/12 text-grape",
    rose: "bg-rose/12 text-rose",
    soft: "bg-ink/6 text-ink-soft",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusChip({ status }: { status: OrderStatus }) {
  const tone =
    status === "livree"
      ? "leaf"
      : status === "annulee" || status === "refusee"
        ? "danger"
        : status === "en_livraison" || status === "recuperee"
          ? "vermillon"
          : status === "prete"
            ? "ambre"
            : "river";
  return <Badge tone={tone as never}>{status === "en_livraison" ? "🛵 " : ""}{statusLabel(status)}</Badge>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ animation: "spin 0.7s linear infinite" }}
      aria-label="Chargement"
    />
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-night/60 backdrop-blur-[3px]" onClick={onClose} />
      <div
        className={`relative anim-pop w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-cream border border-line shadow-2xl`}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-cream/95 backdrop-blur px-5 py-4 rounded-t-3xl">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="btn-ghost !px-2.5 !py-1.5" aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-night/60 backdrop-blur-[3px]" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md anim-drawer bg-cream border-l border-line shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="btn-ghost !px-2.5 !py-1.5" aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-soft">{hint}</p>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 cursor-pointer group"
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-leaf" : "bg-ink/20"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-cream shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
      {label && <span className="text-sm font-bold">{label}</span>}
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  small = false,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  small?: boolean;
}) {
  const btn = `flex items-center justify-center rounded-lg font-black transition cursor-pointer ${small ? "h-7 w-7 text-sm" : "h-9 w-9"} bg-ink/6 hover:bg-vermillon hover:text-cream disabled:opacity-30 disabled:hover:bg-ink/6 disabled:hover:text-ink`;
  return (
    <div className="inline-flex items-center gap-2">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="Diminuer">
        −
      </button>
      <span className={`text-center font-extrabold tabular-nums ${small ? "w-6 text-sm" : "w-8"}`}>{value}</span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label="Augmenter">
        +
      </button>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "text-ink",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: string;
  tone?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className={`mt-1.5 font-display text-2xl font-black tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] font-semibold text-ink-soft">{sub}</p>}
    </div>
  );
}

export function EmptyState({
  emoji,
  title,
  text,
  children,
}: {
  emoji: string;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="text-4xl anim-float">{emoji}</span>
      <p className="font-display text-lg font-bold">{title}</p>
      {text && <p className="max-w-sm text-sm text-ink-soft">{text}</p>}
      {children}
    </div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; badge?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`chip ${active === t.id ? "chip-active" : ""}`}
        >
          {t.label}
          {t.badge !== undefined && t.badge > 0 && (
            <span className={`rounded-full px-1.5 text-[10px] ${active === t.id ? "bg-cream/25" : "bg-vermillon text-cream"}`}>
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Toasts() {
  const toasts = useToasts();
  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 z-[200] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`anim-pop card flex items-start gap-2.5 px-4 py-3 text-sm font-bold shadow-xl ${
            t.kind === "err" ? "border-danger/40 text-danger" : t.kind === "info" ? "border-river/40 text-ink" : "border-leaf/40 text-ink"
          }`}
        >
          <span>{t.kind === "err" ? "⚠️" : t.kind === "info" ? "🔔" : "✅"}</span>
          <span className="flex-1">{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export function PageHead({
  kicker,
  title,
  sub,
  right,
}: {
  kicker: string;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="kicker">{kicker}</p>
        <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
