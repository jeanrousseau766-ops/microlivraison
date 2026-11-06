"use client";

import { use, useState } from "react";
import Link from "next/link";
import { api, usePoll, cartStore, toast } from "@/lib/client";
import type { OrderDetailData } from "@/lib/types";
import { STATUS_FLOW, statusIndex, euro, fmtTime, fmtDateTime, km, VEHICLES, DISPUTE_REASONS } from "@/lib/util";
import { Badge, StatusChip, Modal, Field, EmptyState } from "@/components/ui";
import MapView, { MapMarker } from "@/components/MapView";

export default function TrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, refresh } = usePoll<OrderDetailData>("order", { id }, 3000);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState(DISPUTE_REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState emoji="🔐" title={error} text="Connectez-vous avec le compte ayant passé la commande pour la suivre.">
          <Link href="/connexion" className="btn-primary mt-3">Se connecter</Link>
        </EmptyState>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="skeleton h-10 w-72" />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="skeleton h-96" /><div className="skeleton h-96" />
        </div>
      </div>
    );
  }

  const { order: o, merchant, courier, dispute, canCancel, isOwner } = data;
  const idx = statusIndex(o.status);
  const terminal = o.status === "livree" || o.status === "annulee" || o.status === "refusee";
  const cancelled = o.status === "annulee" || o.status === "refusee";
  const etaMin = o.etaDrop && o.status === "en_livraison" ? Math.max(1, Math.round((o.etaDrop - Date.now()) / 60000)) : null;

  const markers: MapMarker[] = [];
  if (merchant) markers.push({ id: "shop", lat: merchant.lat, lng: merchant.lng, kind: "shop", emoji: merchant.emoji, label: merchant.name });
  markers.push({ id: "home", lat: o.lat, lng: o.lng, kind: "home", label: `Vous — ${o.address}` });
  if (courier && courier.lat !== null && courier.lng !== null)
    markers.push({ id: "courier", lat: courier.lat, lng: courier.lng, kind: "courier", emoji: VEHICLES[courier.vehicle]?.emoji ?? "🛵", label: courier.name });

  const path: [number, number][] | null =
    merchant && (o.status === "en_livraison" || o.status === "recuperee")
      ? [[merchant.lat, merchant.lng], [o.lat, o.lng]]
      : null;

  const doCancel = async () => {
    setBusy(true);
    try {
      await api("cancelOrder", { orderId: o.id });
      toast("Commande annulée — remboursement intégral émis.", "info");
      setCancelOpen(false);
      refresh();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const doDispute = async () => {
    setBusy(true);
    try {
      await api("createDispute", { orderId: o.id, reason, details });
      toast("Réclamation transmise à l'administration.");
      setDisputeOpen(false);
      setDetails("");
      refresh();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const reorder = () => {
    if (!merchant) return;
    for (const it of o.items)
      cartStore.add({ id: merchant.id, name: merchant.name }, { productId: it.productId, name: it.name, emoji: it.emoji, price: it.price, stock: 99 }, it.qty);
    window.dispatchEvent(new Event("locho:cart"));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="kicker">Suivi de commande</p>
          <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">
            {o.code} <span className="text-ink-soft">· {merchant?.emoji} {merchant?.name}</span>
          </h1>
          <p className="mt-1 text-sm text-ink-soft">Passée le {fmtDateTime(o.createdAt)} · {o.recipient} · {o.address}</p>
        </div>
        <StatusChip status={o.status} />
      </div>

      {o.status === "livree" && (
        <div className="anim-pop mt-6 flex flex-wrap items-center gap-4 rounded-3xl bg-gradient-to-r from-leaf to-[#1d7a44] px-6 py-5 text-cream grain relative overflow-hidden">
          <span className="relative text-4xl">🎉</span>
          <div className="relative flex-1">
            <p className="font-display text-xl font-black">Livrée {o.deliveredAt ? `à ${fmtTime(o.deliveredAt)}` : ""} — régalez-vous !</p>
            <p className="text-sm text-cream/85">Merci d'avoir fait vivre le commerce lochois.</p>
          </div>
          {isOwner && <button onClick={reorder} className="btn relative bg-cream text-leaf hover:bg-paper">↻ Recommander</button>}
        </div>
      )}
      {cancelled && (
        <div className="anim-pop mt-6 rounded-3xl border-2 border-danger/30 bg-danger/8 px-6 py-5">
          <p className="font-display text-xl font-black text-danger">{o.status === "refusee" ? "Commande refusée par le commerçant" : "Commande annulée"}</p>
          <p className="mt-1 text-sm font-bold text-ink-soft">{o.cancelReason} · Remboursement intégral de {euro(o.total)} émis via le PSP (2–5 jours ouvrés).</p>
        </div>
      )}
      {etaMin !== null && (
        <div className="anim-pop mt-6 flex items-center gap-4 rounded-3xl bg-night px-6 py-5 text-cream grain relative overflow-hidden">
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-vermillon text-2xl dot-verm">{VEHICLES[courier?.vehicle ?? ""]?.emoji ?? "🛵"}</span>
          <div className="relative">
            <p className="font-display text-2xl font-black">Arrivée estimée dans ~{etaMin} min</p>
            <p className="text-sm text-cream/75">{courier?.name} est en route vers chez vous · position actualisée en direct</p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[380px_1fr]">
        {/* ---------- Timeline ---------- */}
        <div className="card p-6">
          <p className="font-display text-lg font-black">Les 7 étapes</p>
          <div className="mt-5 space-y-0">
            {STATUS_FLOW.map((step, i) => {
              const ev = o.timeline.find((t) => t.status === step.key);
              const done = !!ev && (i < idx || terminal);
              const current = !terminal && Math.floor(idx) === i;
              const isPreteWaiting = o.status === "prete" && step.key === "preparation";
              return (
                <div key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < STATUS_FLOW.length - 1 && (
                    <span className={`absolute left-[15px] top-8 h-[calc(100%-24px)] w-0.5 rounded ${done ? "bg-leaf" : "bg-line"}`} />
                  )}
                  <span
                    className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition-all ${
                      done ? "bg-leaf text-cream" : current || isPreteWaiting ? "bg-vermillon text-cream dot-verm" : "bg-paper text-ink-soft border border-line"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <div className="pt-1">
                    <p className={`text-sm font-extrabold ${done || current ? "" : "text-ink-soft/60"}`}>{step.label}</p>
                    {ev && <p className="text-[11px] font-bold text-ink-soft">{fmtTime(ev.at)}</p>}
                    {isPreteWaiting && (
                      <p className="mt-1 text-[11px] font-bold text-ambre">
                        {o.courierId ? "✔ Prête — votre livreur arrive au commerce" : "✔ Prête — recherche d'un livreur dans le secteur…"}
                      </p>
                    )}
                    {step.key === "recuperee" && o.status === "prete" && o.courierId && (
                      <p className="mt-1 text-[11px] font-bold text-river">Livreur attribué — en approche du commerce</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 border-t border-dashed border-line pt-4 space-y-2">
            {canCancel && (
              <button onClick={() => setCancelOpen(true)} className="btn-ghost w-full !text-danger !border-danger/30 hover:!bg-danger/5">
                Annuler la commande (remboursement intégral)
              </button>
            )}
            {isOwner && !dispute && o.status !== "annulee" && o.status !== "refusee" && (
              <button onClick={() => setDisputeOpen(true)} className="btn-ghost w-full">⚠️ Signaler un problème</button>
            )}
            {dispute && (
              <div className="rounded-xl bg-paper px-4 py-3 text-xs">
                <p className="font-extrabold">Réclamation : {dispute.reason} <Badge tone={dispute.status === "resolu" ? "leaf" : dispute.status === "rejete" ? "danger" : "ambre"}>{dispute.status}</Badge></p>
                {dispute.decision && <p className="mt-1 text-ink-soft">Décision : {dispute.decision}</p>}
              </div>
            )}
          </div>
        </div>

        {/* ---------- Carte + récap ---------- */}
        <div className="space-y-5">
          <div className="card overflow-hidden">
            <MapView
              className="h-[340px] !rounded-none !border-0"
              markers={markers}
              path={path}
              fit
              followId={o.status === "en_livraison" ? "courier" : null}
              center={[o.lat, o.lng]}
              zoom={14}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
              {courier ? (
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-vermillon/12 text-xl">{VEHICLES[courier.vehicle]?.emoji ?? "🛵"}</span>
                  <div>
                    <p className="text-sm font-extrabold">{courier.name}</p>
                    <p className="text-[11px] font-bold text-ink-soft">
                      {VEHICLES[courier.vehicle]?.label ?? courier.vehicle}
                      {courier.lat === null && " · position visible pendant la livraison"}
                    </p>
                  </div>
                  {courier.phone && <a className="btn-soft !py-1.5 !text-xs" href={`tel:${courier.phone.replace(/\s/g, "")}`}>📞 Appeler</a>}
                </div>
              ) : (
                <p className="text-sm font-bold text-ink-soft">
                  {terminal ? "Livraison clôturée — position du livreur non conservée côté client." : "🔎 La position du livreur s'affichera dès l'attribution de votre commande."}
                </p>
              )}
              <span className="text-[11px] font-bold text-ink-soft">Distance : {km(o.distanceKm)} {o.urgent && "· ⚡ urgente"}</span>
            </div>
          </div>

          <div className="card p-5">
            <p className="font-display text-lg font-black">Récapitulatif</p>
            <div className="mt-3 space-y-2 text-sm">
              {o.items.map((it) => (
                <div key={it.productId} className="flex justify-between">
                  <span className="font-bold">{it.emoji} {it.name} <span className="text-ink-soft">×{it.qty}</span></span>
                  <span className="font-black tabular-nums">{euro(it.price * it.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-dashed border-line pt-2 text-[13px]">
                <span className="text-ink-soft">Articles (prix commerçant)</span><span className="font-bold tabular-nums">{euro(o.itemsTotal)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-ink-soft">Frais de livraison</span><span className="font-bold tabular-nums">{euro(o.deliveryFee)}</span>
              </div>
              {o.feeBreakdown && (
                <details className="text-[12px]">
                  <summary className="cursor-pointer font-bold text-river">Détail des frais</summary>
                  <div className="mt-2 space-y-1 rounded-xl bg-paper p-3">
                    {o.feeBreakdown.lines.map((l, i) => (
                      <div key={i} className="flex justify-between"><span className="text-ink-soft">{l.label}</span><span className="tabular-nums font-semibold">{euro(l.amount)}</span></div>
                    ))}
                    <div className="flex justify-between border-t border-line pt-1 text-[11px] text-ink-soft">
                      <span>Réparti : livreur {euro(o.feeBreakdown.courierShare)} · plateforme {euro(o.feeBreakdown.platformShare)}</span>
                    </div>
                  </div>
                </details>
              )}
              <div className="flex justify-between border-t border-line pt-2">
                <span className="font-extrabold">Total TTC payé</span>
                <span className="font-display text-xl font-black tabular-nums text-vermillon-deep">{euro(o.total)}</span>
              </div>
              {o.addressExtra && <p className="rounded-xl bg-paper px-3 py-2 text-xs text-ink-soft">🔑 {o.addressExtra}</p>}
            </div>
          </div>
        </div>
      </div>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Annuler la commande ?">
        <p className="text-sm text-ink-soft">
          La commande {o.code} sera annulée et <strong>{euro(o.total)}</strong> intégralement remboursés via le prestataire de paiement (2–5 jours ouvrés). Le commerçant sera prévenu.
        </p>
        <div className="mt-5 flex gap-2">
          <button onClick={doCancel} disabled={busy} className="btn-danger flex-1">Oui, annuler</button>
          <button onClick={() => setCancelOpen(false)} className="btn-ghost flex-1">Garder ma commande</button>
        </div>
      </Modal>

      <Modal open={disputeOpen} onClose={() => setDisputeOpen(false)} title="Signaler un problème">
        <div className="space-y-4">
          <Field label="Motif">
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              {DISPUTE_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Détails" hint="Votre réclamation est transmise à l'administration, qui peut demander des justificatifs et décider d'un remboursement.">
            <textarea className="input min-h-24" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Décrivez le problème rencontré…" />
          </Field>
          <button onClick={doDispute} disabled={busy} className="btn-primary w-full">Transmettre la réclamation</button>
        </div>
      </Modal>
    </div>
  );
}
