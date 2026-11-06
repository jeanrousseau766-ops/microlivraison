"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, useCart, cartStore, cartTotal, toast } from "@/lib/client";
import type { MeData, PublicData } from "@/lib/types";
import { computeFee, feeTotal, roadKm, euro, km, ADDRESS_PRESETS, LOCHES, serviceOpen } from "@/lib/util";
import { Drawer, Modal, Field, Toggle, Stepper, Spinner } from "@/components/ui";
import MapView from "@/components/MapView";

type Step = "cart" | "checkout" | "processing" | "success";

export default function CheckoutFlow({
  open,
  onClose,
  me,
  pub,
  refreshMe,
  onOrdered,
}: {
  open: boolean;
  onClose: () => void;
  me: MeData | null;
  pub: PublicData | null;
  refreshMe: () => void;
  onOrdered: (id: number) => void;
}) {
  const cart = useCart();
  const router = useRouter();
  const [step, setStep] = useState<Step>("cart");
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [extra, setExtra] = useState("");
  const [pin, setPin] = useState({ lat: LOCHES.lat, lng: LOCHES.lng });
  const [urgent, setUrgent] = useState(false);
  const [cgv, setCgv] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ orderId: number; code: string } | null>(null);

  const merchant = pub?.merchants.find((m) => m.id === cart.merchantId) ?? null;
  const cfg = pub?.config ?? null;
  const subtotal = cartTotal(cart);

  useEffect(() => {
    if (open) {
      setStep("cart");
      setCgv(false);
      setResult(null);
      if (me?.user) {
        setRecipient((r) => r || me.user!.displayName || me.user!.pseudo);
        setPhone((p) => p || me.user!.phone);
        setAddress((a) => a || me.user!.address);
      }
    }
  }, [open, me]);

  const fee = useMemo(() => {
    if (!cfg || !merchant) return null;
    return computeFee(cfg, roadKm(merchant.lat, merchant.lng, pin.lat, pin.lng), merchant.category, urgent);
  }, [cfg, merchant, pin, urgent]);

  const distance = merchant ? roadKm(merchant.lat, merchant.lng, pin.lat, pin.lng) : 0;
  const deliveryFee = fee ? feeTotal(fee) : 0;
  const total = subtotal + deliveryFee;
  const isOpen = cfg ? serviceOpen(cfg) : true;

  const startCheckout = () => {
    if (!me?.user) {
      toast("Connectez-vous pour commander — création de compte en 10 secondes.", "info");
      onClose();
      router.push("/connexion?return=/");
      return;
    }
    if (me.user.role !== "client") {
      toast("Utilisez un compte client pour commander (ex. camille / demo1234).", "err");
      return;
    }
    if (!isOpen) {
      toast(`Service fermé : livraisons de ${cfg?.openHour}h à ${cfg?.closeHour}h.`, "err");
      return;
    }
    if (merchant && !merchant.open) {
      toast(`${merchant.name} est actuellement fermé.`, "err");
      return;
    }
    setStep("checkout");
  };

  const pay = async () => {
    if (!cgv) {
      toast("Veuillez accepter les CGV et la politique de confidentialité.", "err");
      return;
    }
    if (!recipient.trim() || !phone.trim() || !address.trim()) {
      toast("Destinataire, téléphone et adresse sont requis.", "err");
      return;
    }
    setBusy(true);
    setStep("processing");
    try {
      await new Promise((r) => setTimeout(r, 1400));
      const res = await api<{ orderId: number; code: string }>("createOrder", {
        merchantId: cart.merchantId,
        items: cart.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        recipient,
        phone,
        address,
        addressExtra: extra,
        lat: pin.lat,
        lng: pin.lng,
        urgent,
      });
      setResult(res);
      cartStore.clear();
      refreshMe();
      setStep("success");
    } catch (e) {
      toast((e as Error).message, "err");
      setStep("checkout");
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Panier ---------- */
  if (!open) return null;

  if (step === "cart") {
    return (
      <Drawer open={open} onClose={onClose} title={<>Votre panier {cart.lines.length > 0 && <span className="text-vermillon">· {cart.merchantName}</span>}</>}>
        {cart.lines.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="text-5xl anim-float">🧺</span>
            <p className="font-display text-lg font-bold">Panier vide</p>
            <p className="text-sm text-ink-soft">Parcourez les commerces de Loches et ajoutez vos envies.</p>
            <Link href="/#commerces" onClick={onClose} className="btn-primary mt-2">Découvrir les commerces</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {!isOpen && (
              <div className="rounded-xl border border-ambre/50 bg-ambre/10 px-4 py-3 text-sm font-bold text-[#8a5a00]">
                🌙 Service fermé — livraisons tous les jours de {cfg?.openHour}h à {cfg?.closeHour}h. Vous pourrez finaliser à la réouverture.
              </div>
            )}
            {merchant && !merchant.open && isOpen && (
              <div className="rounded-xl border border-ambre/50 bg-ambre/10 px-4 py-3 text-sm font-bold text-[#8a5a00]">
                ⏰ {merchant.name} est fermé ({merchant.openHour}h–{merchant.closeHour}h).
              </div>
            )}
            <div className="space-y-3">
              {cart.lines.map((l) => (
                <div key={l.productId} className="card flex items-center gap-3 p-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-paper text-xl">{l.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">{l.name}</p>
                    <p className="text-xs font-bold text-ink-soft">{euro(l.price)} / unité</p>
                  </div>
                  <Stepper small value={l.qty} min={0} max={l.stock} onChange={(v) => cartStore.setQty(l.productId, v)} />
                  <span className="w-16 text-right text-sm font-black tabular-nums">{euro(l.price * l.qty)}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink-soft">Un panier = un commerce. Ajouter un article d'une autre boutique remplacera ce panier.</p>
            <div className="card space-y-2 p-4">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-ink-soft">Sous-total articles</span>
                <span className="tabular-nums">{euro(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-ink-soft">Frais de livraison</span>
                <span className="text-xs text-ink-soft">calculés à l'étape suivante</span>
              </div>
              <button onClick={startCheckout} className="btn-primary w-full !py-3.5 text-base">
                Passer commande →
              </button>
              <p className="text-center text-[11px] text-ink-soft">🔒 Paiement sécurisé via prestataire agréé (démo)</p>
            </div>
          </div>
        )}
      </Drawer>
    );
  }

  /* ---------- Confirmation ---------- */
  if (step === "success" && result) {
    return (
      <Modal open={open} onClose={onClose} title="Commande confirmée">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-leaf/15 text-4xl anim-pop">✅</span>
          <h3 className="font-display text-2xl font-black">Merci ! Commande {result.code}</h3>
          <p className="max-w-sm text-sm text-ink-soft">
            Paiement de <strong>{euro(total)}</strong> confirmé. {merchant?.name} reçoit votre commande ; vous serez
            notifié à chaque étape, et vous pourrez suivre votre livreur sur la carte.
          </p>
          <button onClick={() => onOrdered(result.orderId)} className="btn-primary mt-2 !px-6 !py-3">
            📍 Suivre ma commande en direct
          </button>
          <button onClick={onClose} className="btn-ghost">Continuer mes achats</button>
        </div>
      </Modal>
    );
  }

  /* ---------- Checkout ---------- */
  return (
    <Modal open={open} onClose={busy ? () => undefined : onClose} title={step === "processing" ? "Paiement sécurisé…" : "Finaliser la commande"} wide>
      {step === "processing" ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Spinner className="!h-10 !w-10 text-vermillon" />
          <p className="font-display text-lg font-bold">Traitement du paiement de {euro(total)}…</p>
          <p className="text-xs text-ink-soft">Connexion au prestataire de paiement (mode démonstration)</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_330px]">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom du destinataire">
                <input className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Prénom Nom" />
              </Field>
              <Field label="Téléphone">
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" />
              </Field>
            </div>
            <Field label="Adresse de livraison" hint="Choisissez un repère puis ajustez l'épingle sur la carte — les frais s'actualisent en direct.">
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="N°, rue, code postal, ville" />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {ADDRESS_PRESETS.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  className="chip !py-1.5 !text-[11px]"
                  onClick={() => {
                    setAddress(a.label + ", 37600");
                    setPin({ lat: a.lat, lng: a.lng });
                  }}
                >
                  📍 {a.label}
                </button>
              ))}
            </div>
            <MapView
              className="h-52"
              center={[pin.lat, pin.lng]}
              zoom={14}
              markers={[
                { id: "pin", lat: pin.lat, lng: pin.lng, kind: "home", label: "Votre adresse — déplacez-moi" },
                ...(merchant ? [{ id: "shop", lat: merchant.lat, lng: merchant.lng, kind: "shop" as const, emoji: merchant.emoji, label: merchant.name }] : []),
              ]}
              draggableId="pin"
              onPick={(lat, lng) => setPin({ lat, lng })}
            />
            <Field label="Accès au logement (digicode, étage, consignes…)">
              <textarea className="input min-h-16" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Digicode A1234, 2e étage, sonner Roux…" />
            </Field>
            <div className="card flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-extrabold">⚡ Livraison urgente</p>
                <p className="text-xs text-ink-soft">Priorité d'attribution · +{cfg ? euro(cfg.urgentSupplement) : "2,00 €"}</p>
              </div>
              <Toggle checked={urgent} onChange={setUrgent} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">Vendu par</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-extrabold">
                <span className="text-lg">{merchant?.emoji}</span> {merchant?.name}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-soft">{merchant?.legalName} — Locho est uniquement prestataire de livraison. Prix fixés par le commerçant, sans marge plateforme.</p>
              <div className="my-3 border-t border-dashed border-line" />
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between font-bold">
                  <span className="text-ink-soft">Articles ({cart.lines.reduce((s, l) => s + l.qty, 0)})</span>
                  <span className="tabular-nums">{euro(subtotal)}</span>
                </div>
                {fee?.lines.map((l, i) => (
                  <div key={i} className="flex justify-between text-[13px]">
                    <span className="text-ink-soft">{l.label}</span>
                    <span className="tabular-nums font-semibold">{euro(l.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[13px] font-bold">
                  <span>Frais de livraison ({km(distance)})</span>
                  <span className="tabular-nums">{euro(deliveryFee)}</span>
                </div>
              </div>
              <div className="my-3 border-t border-dashed border-line" />
              <div className="flex items-baseline justify-between">
                <span className="font-extrabold">Total TTC</span>
                <span className="font-display text-2xl font-black tabular-nums text-vermillon-deep">{euro(total)}</span>
              </div>
              <p className="mt-2 text-[11px] text-ink-soft">
                ⏱ Délai annoncé : 25–40 min · {pub?.stats.couriersOnline ?? 0} livreur(s) en ligne dans le secteur
                {pub && pub.stats.couriersOnline === 0 && " — attribution dès qu'un livreur se connecte"}
              </p>
            </div>
            <div className="card space-y-2 p-4 text-[11px] leading-relaxed text-ink-soft">
              <p>💳 Carte bancaire via prestataire de paiement agréé multi-vendeurs (démo — aucun débit réel). Fonds répartis automatiquement : commerçant, livreur, plateforme.</p>
              <p>↩️ Annulation gratuite avant préparation avancée, remboursement intégral sous 2–5 jours. Réclamation via votre espace commandes. Droit de rétractation de 14 j sauf produits périssables ou confectionnés sur mesure (<Link className="underline" href="/legal#cgv">détails CGV</Link>).</p>
              <label className="flex cursor-pointer items-start gap-2 pt-1 text-ink">
                <input type="checkbox" checked={cgv} onChange={(e) => setCgv(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#E4572E]" />
                <span className="font-bold">
                  J'accepte les <Link href="/legal#cgv" className="underline">CGV</Link> et la{" "}
                  <Link href="/legal#confidentialite" className="underline">politique de confidentialité</Link>.
                </span>
              </label>
            </div>
            <button onClick={pay} disabled={busy || !cgv} className="btn-primary w-full !py-4 text-base">
              🔒 Payer {euro(total)}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
