"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePoll, useCart, cartStore, toast, useReveal } from "@/lib/client";
import type { PublicData, PublicMerchant, PublicProduct, MeData, ClientData } from "@/lib/types";
import { CATEGORY_META, euro, hoursLabel, ACTIVE_STATUSES } from "@/lib/util";
import { Badge, Stepper, StatusChip } from "@/components/ui";
import MapView from "@/components/MapView";

function ProductCard({ p, m }: { p: PublicProduct; m: PublicMerchant | undefined }) {
  const cart = useCart();
  const line = cart.lines.find((l) => l.productId === p.id);
  const meta = CATEGORY_META[m?.category ?? ""] ?? { emoji: "🛍️", cover: "ambre" };
  const add = () => {
    if (!m) return;
    const res = cartStore.add({ id: m.id, name: m.name }, { productId: p.id, name: p.name, emoji: p.emoji, price: p.price, stock: p.stock });
    toast(res === "replaced" ? `Panier remplacé : bienvenue chez ${m.name} !` : `${p.emoji} ${p.name} ajouté au panier`, res === "replaced" ? "info" : "ok");
  };
  const disabled = !p.available || p.stock === 0 || !m?.open;
  return (
    <div className="card group flex flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
      <div className={`cover-${meta.cover} grain relative flex h-28 items-center justify-center`}>
        <span className="relative text-5xl drop-shadow-lg transition group-hover:scale-110">{p.emoji}</span>
        {p.stock > 0 && p.stock <= 5 && (
          <span className="absolute right-2 top-2 rounded-full bg-night/70 px-2 py-0.5 text-[10px] font-extrabold text-cream">Plus que {p.stock}</span>
        )}
        {(!p.available || p.stock === 0) && (
          <span className="absolute inset-0 flex items-center justify-center bg-night/60 text-xs font-black uppercase tracking-widest text-cream">Indisponible</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        {m && <Link href={`/boutique/${m.id}`} className="text-[10px] font-extrabold uppercase tracking-wider text-ink-soft hover:text-vermillon-deep">{m.emoji} {m.name}</Link>}
        <p className="mt-1 text-sm font-extrabold leading-snug">{p.name}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{p.description}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-display text-lg font-black tabular-nums">{euro(p.price)}</span>
          {line && cart.merchantId === m?.id ? (
            <Stepper small value={line.qty} min={0} max={p.stock} onChange={(v) => cartStore.setQty(p.id, v)} />
          ) : (
            <button onClick={add} disabled={disabled} className="btn-primary !px-3 !py-1.5 !text-xs">+ Ajouter</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { data } = usePoll<PublicData>("public", {}, 12000);
  const me = usePoll<MeData>("me", {}, 20000);
  const isClient = me.data?.user?.role === "client";
  const client = usePoll<ClientData>("client", {}, isClient ? 6000 : 3600000);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("Tout");
  useReveal();

  const merchants = useMemo(() => {
    const list = data?.merchants ?? [];
    const filtered = cat === "Tout" ? list : list.filter((m) => m.category === cat);
    return [...filtered].sort((a, b) => Number(b.open) - Number(a.open));
  }, [data, cat]);

  const results = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return data.products
      .filter((p) => p.available && (p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)))
      .slice(0, 12);
  }, [data, query]);

  const popular = useMemo(() => {
    if (!data) return [];
    const openIds = new Set(data.merchants.filter((m) => m.open).map((m) => m.id));
    const pool = data.products.filter((p) => p.available && openIds.has(p.merchantId));
    return (cat === "Tout" ? pool : pool.filter((p) => data.merchants.find((m) => m.id === p.merchantId)?.category === cat)).slice(0, 8);
  }, [data, cat]);

  const activeOrder = client.data?.orders.find((o) => ACTIVE_STATUSES.includes(o.status));
  const mMap = useMemo(() => new Map((data?.merchants ?? []).map((m) => [m.id, m])), [data]);
  const cfg = data?.config;

  return (
    <div>
      {/* ---------- HÉRO ---------- */}
      <section className="relative overflow-hidden bg-night text-cream grain">
        <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-vermillon/25 blur-[110px]" />
        <div className="pointer-events-none absolute right-0 bottom-0 h-80 w-80 rounded-full bg-river/20 blur-[100px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <p className="anim-rise inline-flex items-center gap-2 rounded-full border border-ambre/40 bg-ambre/10 px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-ambre">
              <span className="h-1.5 w-1.5 rounded-full bg-ambre" /> Cité royale · Indre-et-Loire
            </p>
            <h1 className="anim-rise mt-5 font-display text-[42px] font-black leading-[1.04] sm:text-6xl" style={{ animationDelay: "80ms" }}>
              Tout Loches,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-ambre via-vermillon to-rose">livré chez vous.</span>
            </h1>
            <p className="anim-rise mt-5 max-w-lg text-[15px] leading-relaxed text-cream/75" style={{ animationDelay: "160ms" }}>
              Repas, courses, pain frais, fleurs, cadeaux ou colis : commandez chez vos commerçants locaux,
              un livreur indépendant du secteur vous apporte le tout — de 4h à 23h, 7 j/7.
            </p>
            <div className="anim-rise mt-7 flex max-w-xl items-center gap-2 rounded-2xl border border-cream/15 bg-cream/10 p-2 backdrop-blur focus-within:border-ambre/60" style={{ animationDelay: "240ms" }}>
              <span className="pl-2 text-lg">🔎</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Croissants, bouquet, bourguignon, pile AA…"
                className="w-full bg-transparent py-2 text-sm font-semibold text-cream placeholder:text-cream/40 focus:outline-none"
                aria-label="Rechercher un produit"
              />
              {query && (
                <a href="#resultats" className="btn-primary shrink-0 !py-2">{results.length} résultat{results.length > 1 ? "s" : ""}</a>
              )}
            </div>
            <div className="anim-rise mt-6 flex flex-wrap gap-2.5 text-[12px] font-extrabold" style={{ animationDelay: "320ms" }}>
              <span className="rounded-full bg-cream/10 px-3.5 py-2">🏪 {data?.stats.merchantsOpen ?? "…"} commerces ouverts</span>
              <span className="rounded-full bg-cream/10 px-3.5 py-2">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-leaf dot-live" />
                {data?.stats.couriersOnline ?? "…"} livreurs en ligne
              </span>
              <span className="rounded-full bg-cream/10 px-3.5 py-2">🕓 {cfg ? hoursLabel(cfg.openHour, cfg.closeHour) : "04h – 23h"}</span>
            </div>
          </div>
          <div className="relative anim-rise" style={{ animationDelay: "200ms" }}>
            <div className="overflow-hidden rounded-3xl border-2 border-cream/15 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/hero-loches.jpg" alt="Loches au lever du jour, un livreur longe l'Indre" className="h-full w-full object-cover" />
            </div>
            <div className="anim-float absolute -left-3 bottom-6 card flex items-center gap-3 px-4 py-3 !bg-cream text-ink">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-vermillon text-lg dot-verm">🛵</span>
              <div>
                <p className="text-xs font-extrabold">Sofia arrive dans 4 min</p>
                <p className="text-[10px] font-bold text-ink-soft">Suivi GPS en temps réel</p>
              </div>
            </div>
            <div className="anim-float absolute -right-2 top-6 card px-4 py-2.5 !bg-cream text-ink" style={{ animationDelay: "1.2s" }}>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-soft">Frais de livraison</p>
              <p className="font-display text-lg font-black text-vermillon-deep">dès {cfg ? euro(cfg.minFee) : "3,90 €"}</p>
            </div>
          </div>
        </div>
        {/* Bandeau défilant */}
        <div className="relative border-t border-cream/10 bg-vermillon py-2.5 overflow-hidden">
          <div className="marquee-track gap-8 text-[12px] font-extrabold uppercase tracking-[0.18em] text-cream">
            {[0, 1].map((k) => (
              <div key={k} className="flex shrink-0 gap-8">
                {Object.entries(CATEGORY_META).map(([name, meta]) => (
                  <span key={name + k} className="flex items-center gap-2">{meta.emoji} {name} <span className="text-ambre">✦</span></span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Commande en cours ---------- */}
      {isClient && activeOrder && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Link href={`/commande/${activeOrder.id}`} className="anim-pop mt-6 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-vermillon/40 bg-vermillon/8 px-5 py-4 transition hover:border-vermillon">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-vermillon text-lg text-cream dot-verm">{activeOrder.merchantEmoji}</span>
            <div className="flex-1">
              <p className="text-sm font-extrabold">Commande {activeOrder.code} · {activeOrder.merchantName}</p>
              <p className="text-xs text-ink-soft">Toucher pour suivre la livraison en direct</p>
            </div>
            <StatusChip status={activeOrder.status} />
            <span className="font-black text-vermillon-deep">→</span>
          </Link>
        </div>
      )}

      {/* ---------- Catégories + commerces ---------- */}
      <section id="commerces" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="reveal flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="kicker">Les commerces partenaires</p>
            <h2 className="mt-1 font-display text-3xl font-black sm:text-4xl">Le marché de la Cité, dans votre poche</h2>
          </div>
          <p className="text-sm font-bold text-ink-soft">Prix fixés par les commerçants · 0 % de marge plateforme</p>
        </div>
        <div className="reveal mt-6 flex gap-2 overflow-x-auto pb-2">
          <button className={`chip ${cat === "Tout" ? "chip-active" : ""}`} onClick={() => setCat("Tout")}>✨ Tout</button>
          {Object.entries(CATEGORY_META).map(([name, meta]) => (
            <button key={name} className={`chip ${cat === name ? "chip-active" : ""}`} onClick={() => setCat(name)}>
              {meta.emoji} {name}
            </button>
          ))}
        </div>

        {!data ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-56" />)}
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {merchants.map((m, i) => (
              <Link
                key={m.id}
                href={`/boutique/${m.id}`}
                className="reveal card group overflow-hidden transition hover:-translate-y-1 hover:shadow-xl"
                style={{ transitionDelay: `${(i % 3) * 70}ms` }}
              >
                <div className={`cover-${m.cover} grain relative flex h-32 items-center justify-center`}>
                  <span className="relative text-6xl drop-shadow-xl transition duration-300 group-hover:scale-110 group-hover:-rotate-6">{m.emoji}</span>
                  <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${m.open ? "bg-leaf text-cream" : "bg-night/70 text-cream"}`}>
                    {m.open ? "● Ouvert" : "Fermé"}
                  </span>
                  <span className="absolute right-3 top-3 rounded-full bg-night/60 px-2.5 py-1 text-[11px] font-extrabold text-ambre">★ {m.rating.toFixed(1)}</span>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-black leading-tight">{m.name}</h3>
                    <Badge tone="soft">{m.category}</Badge>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-soft">{m.description}</p>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-ink-soft">
                    <span>📍 {m.address.split(",")[0]}</span>
                    <span>{m.open ? `Ferme à ${m.closeHour}h` : `Ouvre à ${m.openHour}h`} · {hoursLabel(m.openHour, m.closeHour)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Résultats / populaires ---------- */}
      <section id="resultats" className="bg-cream/60 py-12 border-y border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="reveal flex items-end justify-between gap-3">
            <div>
              <p className="kicker">{query ? "Recherche" : "Envies du moment"}</p>
              <h2 className="mt-1 font-display text-3xl font-black">
                {query ? <>Résultats pour « {query} »</> : "Populaires en ce moment"}
              </h2>
            </div>
            {query && <button className="btn-ghost" onClick={() => setQuery("")}>Effacer</button>}
          </div>
          {query && results.length === 0 && data ? (
            <p className="mt-8 rounded-2xl border border-dashed border-line bg-paper px-6 py-10 text-center text-sm font-bold text-ink-soft">
              Aucun produit ne correspond… Essayez « pain », « bouquet », « fromage » ou parcourez les catégories.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {(query ? results : popular).map((p) => <ProductCard key={p.id} p={p} m={mMap.get(p.merchantId)} />)}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Fonctionnement + carte ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div className="reveal">
            <p className="kicker">Comment ça marche</p>
            <h2 className="mt-1 font-display text-3xl font-black sm:text-4xl">Trois temps, sept étapes suivies</h2>
            <div className="mt-7 space-y-4">
              {[
                { n: "01", t: "Commandez en quelques gestes", d: "Compte créé avec un simple pseudonyme. Adresse et accès demandés uniquement au moment de la commande. Frais de livraison affichés avant paiement, au centime.", e: "🧺", c: "text-vermillon" },
                { n: "02", t: "Le commerce prépare", d: "Le commerçant accepte, annonce son temps de préparation et signale la commande prête. Ses prix restent les siens, sans commission plateforme.", e: "👨‍🍳", c: "text-ambre" },
                { n: "03", t: "Un livreur du secteur vous livre", d: "Attribution automatique selon la zone, la capacité choisie par chaque livreur et les places disponibles. Position du livreur visible uniquement pour votre commande.", e: "🛵", c: "text-river" },
              ].map((s) => (
                <div key={s.n} className="card flex gap-4 p-5">
                  <span className={`font-display text-3xl font-black ${s.c}`}>{s.n}</span>
                  <div>
                    <p className="font-extrabold">{s.e} {s.t}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-night px-5 py-4 text-cream grain relative overflow-hidden">
              <p className="relative text-[12px] font-bold leading-relaxed text-cream/80">
                🔔 À chaque étape, une notification : confirmation, acceptation, livreur attribué, départ, approche,
                livraison terminée — et alerte en cas de problème.
              </p>
            </div>
          </div>
          <div className="reveal">
            <p className="kicker">Zone de livraison</p>
            <h2 className="mt-1 font-display text-3xl font-black">Loches & alentours</h2>
            <p className="mt-2 text-sm text-ink-soft">
              {cfg?.zones.join(" · ") ?? "Loches · Beaulieu-lès-Loches · Perrusson"} — le rayon s'étend avec chaque nouveau livreur.
            </p>
            <MapView
              className="mt-5 h-[380px]"
              center={[47.1289, 0.9973]}
              zoom={13}
              markers={(data?.merchants ?? []).map((m) => ({ id: `m${m.id}`, lat: m.lat, lng: m.lng, kind: "shop" as const, emoji: m.emoji, label: m.name }))}
              circle={{ lat: 47.1289, lng: 0.9973, km: 5 }}
            />
            <p className="mt-2 text-[11px] text-ink-soft">📍 Commerces partenaires uniquement — la position des livreurs n'est jamais publique.</p>
          </div>
        </div>
      </section>

      {/* ---------- Recrutement ---------- */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="reveal relative overflow-hidden rounded-3xl bg-gradient-to-br from-river to-[#12327e] p-8 text-cream grain">
            <span className="absolute -right-4 -bottom-6 text-[120px] opacity-20">🛵</span>
            <p className="relative text-[11px] font-extrabold uppercase tracking-[0.2em] text-cream/60">Indépendants</p>
            <h3 className="relative mt-2 font-display text-3xl font-black">Roulez quand vous voulez.</h3>
            <p className="relative mt-3 max-w-sm text-sm leading-relaxed text-cream/80">
              Choisissez vos heures (04h–23h), votre nombre de courses, votre point central et votre rayon.
              {" "}{cfg?.courierSharePercent ?? 70} % des frais de livraison vous reviennent. Tableau de revenus et versements inclus.
            </p>
            <Link href="/livreur" className="btn relative mt-6 bg-cream text-river hover:bg-paper">Devenir livreur →</Link>
          </div>
          <div className="reveal relative overflow-hidden rounded-3xl bg-gradient-to-br from-leaf to-[#14532d] p-8 text-cream grain" style={{ transitionDelay: "100ms" }}>
            <span className="absolute -right-4 -bottom-6 text-[120px] opacity-20">🏪</span>
            <p className="relative text-[11px] font-extrabold uppercase tracking-[0.2em] text-cream/60">Commerçants</p>
            <h3 className="relative mt-2 font-display text-3xl font-black">Vos prix, vos règles.</h3>
            <p className="relative mt-3 max-w-sm text-sm leading-relaxed text-cream/80">
              Boutique, stocks, horaires et commandes en autonomie. Aucune commission sur vos produits :
              la plateforme ne vit que sur les frais de livraison.
            </p>
            <Link href="/commercant" className="btn relative mt-6 bg-cream text-leaf hover:bg-paper">Ouvrir ma boutique →</Link>
          </div>
        </div>
        <div className="reveal mt-8 grid gap-3 rounded-2xl border border-line bg-cream px-6 py-5 text-[12px] font-bold text-ink-soft sm:grid-cols-3">
          <span>🔒 Mots de passe hachés · HTTPS · journalisation admin · RGPD</span>
          <span>🧾 Chaque euro tracé : commerçant, livreur, plateforme, remboursements</span>
          <span>⚖️ Produits réglementés exclus du catalogue — <Link href="/legal#produits" className="underline">voir la liste</Link></span>
        </div>
      </section>
    </div>
  );
}
