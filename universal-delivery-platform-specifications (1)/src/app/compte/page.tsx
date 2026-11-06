"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, usePoll, cartStore, toast } from "@/lib/client";
import type { MeData, ClientData, PublicData } from "@/lib/types";
import { euro, fmtDateTime, ACTIVE_STATUSES } from "@/lib/util";
import { Badge, StatusChip, Modal, PageHead, EmptyState } from "@/components/ui";

export default function ComptePage() {
  const me = usePoll<MeData>("me", {}, 10000);
  const isClient = me.data?.user?.role === "client";
  const client = usePoll<ClientData>("client", {}, isClient ? 7000 : 3600000);
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const user = me.data?.user;

  if (!me.data) return <div className="mx-auto max-w-5xl px-4 py-10"><div className="skeleton h-64" /></div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState emoji="👤" title="Votre espace personnel" text="Connectez-vous pour retrouver vos commandes, notifications et données personnelles.">
          <Link href="/connexion?return=/compte" className="btn-primary mt-3">Se connecter</Link>
        </EmptyState>
      </div>
    );
  }

  const orders = client.data?.orders ?? [];
  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const past = orders.filter((o) => !ACTIVE_STATUSES.includes(o.status));

  const reorder = (orderId: number) => {
    const o = orders.find((x) => x.id === orderId);
    if (!o) return;
    for (const it of o.items)
      cartStore.add({ id: o.merchantId, name: o.merchantName }, { productId: it.productId, name: it.name, emoji: it.emoji, price: it.price, stock: 99 }, it.qty);
    window.dispatchEvent(new Event("locho:cart"));
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await api("deleteAccount");
      toast("Compte supprimé et données anonymisées (RGPD).", "info");
      router.push("/");
      me.refresh();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
      setDelOpen(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHead kicker="Espace client" title={<>Bonjour, {user.displayName || user.pseudo} 👋</>} sub={`Membre depuis le ${fmtDateTime(user.createdAt)} · pseudonyme @${user.pseudo}`} />

      {user.role !== "client" && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm font-bold">Vous êtes connecté·e en tant que <Badge tone="river">{user.role}</Badge> — votre espace de travail vous attend.</p>
          <Link href={user.role === "livreur" ? "/livreur" : user.role === "commercant" ? "/commercant" : "/admin"} className="btn-primary">Ouvrir mon espace →</Link>
        </div>
      )}

      {isClient && (
        <>
          {active.length > 0 && (
            <div className="mb-8">
              <h2 className="font-display text-xl font-black">En cours</h2>
              <div className="mt-3 space-y-3">
                {active.map((o) => (
                  <Link key={o.id} href={`/commande/${o.id}`} className="card flex flex-wrap items-center gap-4 p-4 transition hover:border-vermillon/50 hover:shadow-lg">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-vermillon/10 text-2xl dot-verm">{o.merchantEmoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold">{o.code} · {o.merchantName}</p>
                      <p className="text-xs text-ink-soft">{o.items.reduce((s, i) => s + i.qty, 0)} article(s) · {euro(o.total)} · {fmtDateTime(o.createdAt)}</p>
                    </div>
                    <StatusChip status={o.status} />
                    <span className="font-black text-vermillon-deep">Suivre →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <h2 className="font-display text-xl font-black">Commandes précédentes</h2>
          {past.length === 0 && active.length === 0 ? (
            <div className="mt-3">
              <EmptyState emoji="🧾" title="Aucune commande pour l'instant" text="Vos commandes passées apparaîtront ici, avec leur suivi détaillé.">
                <Link href="/#commerces" className="btn-primary mt-3">Explorer les commerces</Link>
              </EmptyState>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {past.map((o) => (
                <div key={o.id} className="card flex flex-wrap items-center gap-4 p-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-paper text-2xl">{o.merchantEmoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">{o.code} · {o.merchantName}</p>
                    <p className="truncate text-xs text-ink-soft">{o.items.map((i) => `${i.emoji} ${i.name} ×${i.qty}`).join(" · ")}</p>
                    <p className="text-[11px] font-bold text-ink-soft/70">{fmtDateTime(o.createdAt)} · {euro(o.total)}</p>
                  </div>
                  <StatusChip status={o.status} />
                  <div className="flex gap-2">
                    {o.status === "livree" && <button onClick={() => reorder(o.id)} className="btn-soft !py-2 !text-xs">↻ Recommander</button>}
                    <Link href={`/commande/${o.id}`} className="btn-ghost !py-2 !text-xs">Détails</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* RGPD */}
      <div className="card mt-10 p-6">
        <h2 className="font-display text-lg font-black">🔐 Mes données personnelles (RGPD)</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Votre compte ne requiert qu'un pseudonyme et un mot de passe haché. Les données de livraison ne sont utilisées
          que pour la commande concernée ; la position des livreurs n'est partagée qu'avec le client concerné, pendant sa
          livraison. Vous disposez d'un droit d'accès, de rectification et d'effacement —{" "}
          <Link href="/legal#confidentialite" className="underline">politique de confidentialité</Link>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="btn-ghost !text-xs" href={`mailto:privacy@locho.fr?subject=Demande RGPD - ${user.pseudo}`}>Demander une copie de mes données</a>
          <button onClick={() => setDelOpen(true)} className="btn-ghost !text-xs !text-danger !border-danger/30">Supprimer mon compte</button>
        </div>
      </div>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Supprimer définitivement le compte ?">
        <p className="text-sm leading-relaxed text-ink-soft">
          Conformément au RGPD, votre compte sera désactivé et vos données personnelles <strong>anonymisées</strong> :
          pseudonyme, coordonnées et profil effacés. Les commandes en cours seront remboursées. Les écritures financières
          légales sont conservées sous forme anonymisée pour la durée légale.
        </p>
        <div className="mt-5 flex gap-2">
          <button onClick={deleteAccount} disabled={busy} className="btn-danger flex-1">Supprimer mon compte</button>
          <button onClick={() => setDelOpen(false)} className="btn-ghost flex-1">Conserver</button>
        </div>
      </Modal>
    </div>
  );
}
