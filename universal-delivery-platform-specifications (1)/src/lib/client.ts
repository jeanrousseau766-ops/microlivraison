"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/* ---------- API ---------- */

export async function api<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Une erreur est survenue.");
  return data as T;
}

export function usePoll<T>(
  scope: string,
  params: Record<string, string> = {},
  intervalMs = 5000
): { data: T | null; error: string | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = scope + "?" + new URLSearchParams(params).toString();
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/state?${new URLSearchParams({ scope, ...params }).toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!alive.current) return;
      if (!res.ok) setError((json as { error?: string }).error || "Erreur réseau");
      else {
        setData(json as T);
        setError(null);
      }
    } catch {
      if (alive.current) setError("Connexion au serveur impossible.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    alive.current = true;
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, intervalMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [load, intervalMs]);

  return { data, error, refresh: load };
}

/* ---------- Panier (store externe) ---------- */

export interface CartLine {
  productId: number;
  name: string;
  emoji: string;
  price: number;
  qty: number;
  stock: number;
}

export interface CartState {
  merchantId: number | null;
  merchantName: string;
  lines: CartLine[];
}

const EMPTY_CART: CartState = { merchantId: null, merchantName: "", lines: [] };
let cart: CartState = EMPTY_CART;
let cartLoaded = false;
const cartListeners = new Set<() => void>();

function cartRaw(): string {
  return JSON.stringify(cart);
}

let cartSnapshot = JSON.stringify(EMPTY_CART);

function emitCart() {
  cartSnapshot = cartRaw();
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("locho_cart_v1", cartSnapshot);
    } catch {
      /* stockage indisponible */
    }
  }
  cartListeners.forEach((l) => l());
}

function ensureCartLoaded() {
  if (cartLoaded || typeof window === "undefined") return;
  cartLoaded = true;
  try {
    const raw = localStorage.getItem("locho_cart_v1");
    if (raw) {
      const parsed = JSON.parse(raw) as CartState;
      if (parsed && Array.isArray(parsed.lines)) {
        cart = parsed;
        cartSnapshot = cartRaw();
      }
    }
  } catch {
    /* panier corrompu → réinitialisé */
  }
}

export const cartStore = {
  subscribe(cb: () => void) {
    cartListeners.add(cb);
    return () => cartListeners.delete(cb);
  },
  snapshot(): string {
    ensureCartLoaded();
    return cartSnapshot;
  },
  serverSnapshot(): string {
    return JSON.stringify(EMPTY_CART);
  },
  get(): CartState {
    ensureCartLoaded();
    return cart;
  },
  add(
    merchant: { id: number; name: string },
    line: Omit<CartLine, "qty">,
    qty = 1
  ): "added" | "replaced" {
    ensureCartLoaded();
    let result: "added" | "replaced" = "added";
    if (cart.merchantId !== null && cart.merchantId !== merchant.id && cart.lines.length > 0) {
      cart = { merchantId: merchant.id, merchantName: merchant.name, lines: [] };
      result = "replaced";
    }
    const lines = [...cart.lines];
    const idx = lines.findIndex((l) => l.productId === line.productId);
    if (idx >= 0) {
      lines[idx] = { ...lines[idx], qty: Math.min(lines[idx].qty + qty, line.stock) };
    } else {
      lines.push({ ...line, qty: Math.min(qty, line.stock) });
    }
    cart = { merchantId: merchant.id, merchantName: merchant.name, lines };
    emitCart();
    return result;
  },
  setQty(productId: number, qty: number) {
    ensureCartLoaded();
    const lines = cart.lines
      .map((l) => (l.productId === productId ? { ...l, qty: Math.min(qty, l.stock) } : l))
      .filter((l) => l.qty > 0);
    cart = { ...cart, lines, merchantId: lines.length ? cart.merchantId : null };
    emitCart();
  },
  clear() {
    cart = EMPTY_CART;
    emitCart();
  },
};

export function useCart(): CartState {
  const raw = useSyncExternalStore(cartStore.subscribe, cartStore.snapshot, cartStore.serverSnapshot);
  return JSON.parse(raw) as CartState;
}

export function cartTotal(c: CartState): number {
  return c.lines.reduce((s, l) => s + l.price * l.qty, 0);
}

export function cartCount(c: CartState): number {
  return c.lines.reduce((s, l) => s + l.qty, 0);
}

/* ---------- Toasts ---------- */

export interface ToastMsg {
  id: number;
  text: string;
  kind: "ok" | "err" | "info";
}

let toastId = 0;
let toasts: ToastMsg[] = [];
const toastListeners = new Set<() => void>();

export function toast(text: string, kind: ToastMsg["kind"] = "ok") {
  const id = ++toastId;
  toasts = [...toasts, { id, text, kind }];
  toastListeners.forEach((l) => l());
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    toastListeners.forEach((l) => l());
  }, 4200);
}

export function useToasts(): ToastMsg[] {
  return useSyncExternalStore(
    (cb) => {
      toastListeners.add(cb);
      return () => toastListeners.delete(cb);
    },
    () => toasts,
    () => toasts
  );
}

/* ---------- Divers ---------- */

export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".reveal"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
