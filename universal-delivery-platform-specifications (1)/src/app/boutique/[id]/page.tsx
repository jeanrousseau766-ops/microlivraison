"use client";

import { use } from "react";
import Link from "next/link";
import { usePoll, useCart, cartStore, cartTotal, toast } from "@/lib/client";
import type { PublicData } from "@/lib/types";
import { euro, hoursLabel } from "@/lib/util";
import { Badge, Stepper, EmptyState } from "@/components/ui";
import MapView from "@/components/MapView";

export default function BoutiquePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data } = usePoll<PublicData>("public", {}, 15000);
  const cart = useCart();
  const m = data?.merchants.find((x) => x.id === Number(id));
  const prods = (data?.products ?? []).filter((p) => p.merchantId === Number(id));
  const mine = cart.merchantId === Number(id) ? cart.lines : [];
  const subtotal = cartTotal(cart);

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="skeleton h-48" />
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-44" />)}
        </div>
      </div>
    );
  }
  if (!m) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState emoji="🏚️" title="Boutique introuvable" text="Cette boutique n'existe pas ou n'est plus partenaire.">
          <Link href="/" className="btn-primary mt-3">Retour aux commerces</Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <section className={`cover-${m.cover} grain relative`}>
        <div className="relative mx-auto flex max-w-7xl flex-wrap items-end gap-6 px-4 py-12 sm:px-6">
          <span className="flex h-24 w-24 items-center justify-center rounded-3xl border-2 border-cream/40 bg-night/25 text-6xl shadow-2xl backdrop-blur-sm anim-pop">{m.emoji}</span>
          <div className="min-w-0 flex-1 text-cream">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="ink">{m.category}</Badge>
              <span className="rounded-full bg-night/40 px-2.5 py-1 text-[11px] font-extrabold text-ambre">★ {m.rating.toFixed(1)}</span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${m.open ? "bg-leaf text-cream" : "bg-night/60 text-cream"}`}>
                {m.open ? "● Ouvert" : `Fermé · ouvre à ${m.openHour}h`}
              </span>
            </div>
            <h1 className="mt-2 font-display text-4xl font-black drop-shadow sm:text-5xl">{m.name}</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-cream/90">{m.description}</p>
            <p className="mt-2 text-xs font-bold text-cream/75">📍 {m.address} · 🕓 {hoursLabel(m.openHour, m.closeHour)} · Vendu par {m.legalName}</p>
          </div>
          <Link href="/" className="btn bg-night/40 text-cream backdrop-blur hover:bg-night/60">← Tous les commerces</Link>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div>
          {!m.open && (
            <div className="mb-5 rounded-2xl border border-ambre/50 bg-ambre/10 px-5 py-4 text-sm font-bold text-[#8a5a00]">
              ⏰ {m.name} est fermé pour le moment ({hoursLabel(m.openHour, m.closeHour)}). Vous pouvez préparer votre panier, la commande sera possible à l'ouverture.
            </div>
          )}
          <h2 className="font-display text-2xl font-black">La carte du jour <span className="text-sm font-sans font-bold text-ink-soft">· prix fixés par le commerçant</span></h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {prods.map((p) => {
              const line = mine.find((l) => l.productId === p.id);
              const disabled = !p.available || p.stock === 0 || !m.open;
              return (
                <div key={p.id} className="card flex flex-col p-4 transition hover:shadow-lg">
                  <div className="flex items-start justify-between">
                    <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-paper text-3xl ${!p.available || p.stock === 0 ? "opacity-40 grayscale" : ""}`}>{p.emoji}</span>
                    {p.stock === 0 || !p.available ? (
                      <Badge tone="danger">Épuisé</Badge>
                    ) : p.stock <= 5 ? (
                      <Badge tone="ambre">Plus que {p.stock}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-extrabold leading-snug">{p.name}</p>
                  <p className="mt-1 line-clamp-2 flex-1 text-xs text-ink-soft">{p.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-display text-xl font-black tabular-nums">{euro(p.price)}</span>
                    {line ? (
                      <Stepper small value={line.qty} min={0} max={p.stock} onChange={(v) => cartStore.setQty(p.id, v)} />
                    ) : (
                      <button
                        disabled={disabled}
                        onClick={() => {
                          const res = cartStore.add({ id: m.id, name: m.name }, { productId: p.id, name: p.name, emoji: p.emoji, price: p.price, stock: p.stock });
                          toast(res === "replaced" ? "Panier remplacé par cette boutique." : `${p.emoji} Ajouté au panier`, res === "replaced" ? "info" : "ok");
                        }}
                        className="btn-primary !px-3.5 !py-2 !text-xs"
                      >
                        + Ajouter
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {prods.length === 0 && <EmptyState emoji="📦" title="Catalogue en préparation" text="Le commerçant n'a pas encore publié ses produits." />}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 self-start">
          <div className="card p-5">
            <p className="font-display text-lg font-black">Votre panier</p>
            {mine.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">{cart.lines.length > 0 ? `Un panier est ouvert chez ${cart.merchantName}. Ajouter un article d'ici le remplacera.` : "Ajoutez des articles pour commander."}</p>
            ) : (
              <div className="mt-3 space-y-2">
                {mine.map((l) => (
                  <div key={l.productId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-bold">{l.emoji} {l.name} <span className="text-ink-soft">×{l.qty}</span></span>
                    <span className="font-black tabular-nums">{euro(l.price * l.qty)}</span>
                  </div>
                ))}
                <div className="border-t border-dashed border-line pt-2 flex justify-between font-extrabold">
                  <span>Sous-total</span><span className="tabular-nums">{euro(subtotal)}</span>
                </div>
              </div>
            )}
            <button onClick={() => window.dispatchEvent(new Event("locho:cart"))} className="btn-primary mt-4 w-full" disabled={cart.lines.length === 0}>
              🧺 Voir le panier · commander
            </button>
            <p className="mt-2 text-center text-[11px] text-ink-soft">Frais de livraison calculés selon votre adresse</p>
          </div>
          <div className="card overflow-hidden">
            <MapView className="h-48 !rounded-none !border-0" center={[m.lat, m.lng]} zoom={15} markers={[{ id: "shop", lat: m.lat, lng: m.lng, kind: "shop", emoji: m.emoji, label: m.name }]} />
            <div className="p-4 text-xs font-bold text-ink-soft">
              <p>📍 {m.address}</p>
              <p className="mt-1">🕓 {hoursLabel(m.openHour, m.closeHour)} · 7 j/7</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
