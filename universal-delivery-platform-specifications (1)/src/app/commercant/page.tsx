"use client";

import { useEffect, useState } from "react";
import { api, usePoll, toast } from "@/lib/client";
import type { MeData, MerchantData, MerchantOrder, PublicData, PublicProduct } from "@/lib/types";
import type { DocEntry } from "@/lib/util";
import { euro, fmtDateTime, hoursLabel, merchantOpen, CATEGORY_META } from "@/lib/util";
import { Badge, Field, Stepper, Toggle, StatusChip, PageHead, Spinner, EmptyState, Modal, Tabs, Stat } from "@/components/ui";

const COVERS = ["vermillon", "ambre", "leaf", "rose", "grape", "river", "night"];
const EMOJIS = ["🏪", "🍲", "🥐", "🛒", "💐", "🎁", "🧣", "🧁", "🍕", "📚", "🌸", "🥩"];
const DAYS: [string, string][] = [["1", "Lun"], ["2", "Mar"], ["3", "Mer"], ["4", "Jeu"], ["5", "Ven"], ["6", "Sam"], ["0", "Dim"]];

function DocInput({ label, docs, setDocs }: { label: string; docs: DocEntry[]; setDocs: (d: DocEntry[]) => void }) {
  const existing = docs.find((d) => d.name === label);
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-bold transition ${existing ? "border-leaf/50 bg-leaf/8 text-leaf" : "border-dashed border-ink/25 hover:border-leaf/60"}`}>
      <span>{existing ? "✓" : "📎"} {label}</span>
      <span className="text-[11px] text-ink-soft truncate max-w-40">{existing ? existing.fileName : "Joindre un fichier"}</span>
      <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setDocs([...docs.filter((d) => d.name !== label), { name: label, fileName: f.name }]); }} />
    </label>
  );
}

function ApplyForm({ categories }: { categories: string[] }) {
  const [f, setF] = useState({
    pseudo: "", password: "", name: "", legalName: "", representative: "", siret: "", email: "", phone: "",
    address: "", category: categories[0] ?? "Restauration", openHour: 9, closeHour: 19, iban: "", description: "", emoji: "🏪",
  });
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string | number) => setF((x) => ({ ...x, [k]: v }));
  const sanitary = ["Restauration", "Boulangerie", "Courses"].includes(f.category);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("applyCommercant", { ...f, docs });
      toast("Dossier transmis à l'administration ✔");
      window.location.reload();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="card space-y-6 p-6">
      <div>
        <h3 className="font-display text-xl font-black">1 · Votre établissement</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Nom commercial"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="ex. Pâtisserie du Beffroi" /></Field>
          <Field label="Raison sociale"><input className="input" value={f.legalName} onChange={(e) => set("legalName", e.target.value)} placeholder="ex. SAS Beffroi Gourmand" /></Field>
          <Field label="Représentant légal"><input className="input" value={f.representative} onChange={(e) => set("representative", e.target.value)} placeholder="Prénom Nom" /></Field>
          <Field label="N° SIREN / SIRET"><input className="input" value={f.siret} onChange={(e) => set("siret", e.target.value)} placeholder="812 345 678 00017" /></Field>
          <Field label="E-mail professionnel"><input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@boutique.fr" /></Field>
          <Field label="Téléphone"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="02 47 …" /></Field>
          <div className="sm:col-span-2"><Field label="Adresse de l'établissement"><input className="input" value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="N°, rue, 37600 Loches" /></Field></div>
          <Field label="Coordonnées bancaires (reversements)"><input className="input" value={f.iban} onChange={(e) => set("iban", e.target.value)} placeholder="IBAN FR76 …" /></Field>
          <Field label="Type de commerce">
            <select className="input" value={f.category} onChange={(e) => set("category", e.target.value)}>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Ouverture">
            <select className="input" value={f.openHour} onChange={(e) => set("openHour", Number(e.target.value))}>
              {[...Array(24)].map((_, h) => <option key={h} value={h}>{h}h</option>)}
            </select>
          </Field>
          <Field label="Fermeture">
            <select className="input" value={f.closeHour} onChange={(e) => set("closeHour", Number(e.target.value))}>
              {[...Array(24)].map((_, h) => <option key={h} value={h}>{h}h</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2"><Field label="Description de la boutique"><textarea className="input min-h-20" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Votre univers, vos spécialités…" /></Field></div>
        </div>
      </div>
      <div>
        <h3 className="font-display text-xl font-black">2 · Compte de connexion</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Pseudonyme"><input className="input" value={f.pseudo} onChange={(e) => set("pseudo", e.target.value)} placeholder="ex. beffroi" /></Field>
          <Field label="Mot de passe"><input className="input" type="password" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="6 caractères min." /></Field>
        </div>
      </div>
      <div>
        <h3 className="font-display text-xl font-black">3 · Justificatifs</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <DocInput label="Justificatif d'immatriculation (Kbis / SIRENE)" docs={docs} setDocs={setDocs} />
          <DocInput label="Attestation d'assurance professionnelle" docs={docs} setDocs={setDocs} />
          <DocInput label="Autorisation administrative (si requise)" docs={docs} setDocs={setDocs} />
          {sanitary && <DocInput label="Documents sanitaires / HACCP" docs={docs} setDocs={setDocs} />}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
          Vous restez responsable de la conformité, de la qualité et de la légalité de vos produits. Vos prix sont les vôtres :
          la plateforme n'ajoute aucune marge et ne peut pas les modifier.
        </p>
      </div>
      <button className="btn-leaf w-full !py-4 text-base" disabled={busy}>{busy ? <Spinner /> : "Transmettre ma demande d'inscription →"}</button>
    </form>
  );
}

function NewOrderCard({ o, onAction, busy }: { o: MerchantOrder; onAction: (a: string, payload: Record<string, unknown>) => void; busy: boolean }) {
  const [prep, setPrep] = useState(10);
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState("Produit indisponible");
  return (
    <div className="card overflow-hidden border-vermillon/40">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-vermillon/8 px-4 py-3">
        <p className="font-extrabold">🔔 {o.code} · {o.clientName} {o.urgent && <Badge tone="vermillon">⚡ URGENTE</Badge>}</p>
        <span className="font-display text-lg font-black text-vermillon-deep tabular-nums">{euro(o.itemsTotal)}</span>
      </div>
      <div className="space-y-1.5 p-4 text-sm">
        {o.items.map((it) => <p key={it.productId} className="font-bold">{it.emoji} {it.name} <span className="text-ink-soft">×{it.qty}</span></p>)}
        <p className="pt-1 text-xs font-bold text-ink-soft">🏠 {o.recipient} · {o.address} · {fmtDateTime(o.createdAt)}</p>
        {refusing ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <select className="input flex-1 !py-2" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option>Produit indisponible</option><option>Fermeture exceptionnelle</option><option>Trop de commandes en cours</option>
            </select>
            <button disabled={busy} className="btn-danger !text-xs" onClick={() => onAction("merchantRefuse", { orderId: o.id, reason })}>Confirmer le refus</button>
            <button className="btn-ghost !text-xs" onClick={() => setRefusing(false)}>Retour</button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="label !mb-0">Préparation</span>
            <Stepper small value={prep} min={2} max={90} onChange={setPrep} />
            <span className="text-xs font-bold text-ink-soft">min</span>
            <div className="ml-auto flex gap-2">
              <button disabled={busy} className="btn-ghost !text-xs !text-danger !border-danger/30" onClick={() => setRefusing(true)}>Refuser</button>
              <button disabled={busy} className="btn-leaf !text-xs" onClick={() => onAction("merchantAccept", { orderId: o.id, prepMinutes: prep })}>✓ Accepter</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductModal({ open, onClose, product, onSaved }: { open: boolean; onClose: () => void; product: PublicProduct | null; onSaved: () => void }) {
  const [f, setF] = useState({ name: "", description: "", price: "5.00", emoji: "🛍️", stock: 20, available: true });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setF(product
        ? { name: product.name, description: product.description, price: (product.price / 100).toFixed(2), emoji: product.emoji, stock: product.stock, available: product.available }
        : { name: "", description: "", price: "5.00", emoji: "🛍️", stock: 20, available: true });
    }
  }, [open, product]);
  const save = async () => {
    setBusy(true);
    try {
      await api("productSave", { id: product?.id, ...f, price: Math.round(parseFloat(f.price.replace(",", ".")) * 100) });
      toast(product ? "Produit mis à jour." : "Produit ajouté au catalogue.");
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={product ? "Modifier le produit" : "Nouveau produit"}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[80px_1fr]">
          <Field label="Emoji"><input className="input text-center text-xl" value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} /></Field>
          <Field label="Nom du produit"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="ex. Éclair au café" /></Field>
        </div>
        <Field label="Description"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ingrédients, taille, origine…" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prix TTC (€)" hint="Vous seul fixez ce prix — 0 % de commission.">
            <input className="input" type="number" step="0.01" min="0.1" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          </Field>
          <Field label="Stock"><input className="input" type="number" min="0" value={f.stock} onChange={(e) => setF({ ...f, stock: Number(e.target.value) })} /></Field>
        </div>
        <Toggle checked={f.available} onChange={(v) => setF({ ...f, available: v })} label={f.available ? "Disponible à la vente" : "Indisponible (masqué)"} />
        <button onClick={save} disabled={busy} className="btn-leaf w-full">{busy ? <Spinner /> : "Enregistrer"}</button>
      </div>
    </Modal>
  );
}

function Dashboard() {
  const { data, refresh } = usePoll<MerchantData>("merchant", {}, 5000);
  const [tab, setTab] = useState("commandes");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; product: PublicProduct | null }>({ open: false, product: null });
  const [del, setDel] = useState<PublicProduct | null>(null);
  const [shop, setShop] = useState<{ name: string; description: string; emoji: string; cover: string; openHour: number; closeHour: number; days: string; address: string } | null>(null);

  useEffect(() => {
    if (data && !shop) {
      const m = data.merchant;
      setShop({ name: m.name, description: m.description, emoji: m.emoji, cover: m.cover, openHour: m.openHour, closeHour: m.closeHour, days: m.days, address: m.address });
    }
  }, [data, shop]);

  const onAction = async (a: string, payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      await api(a, payload);
      toast(a === "merchantAccept" ? "Commande acceptée ✔" : a === "merchantRefuse" ? "Commande refusée — client remboursé." : a === "merchantPreparing" ? "Préparation lancée 👨‍🍳" : "Commande prête — attribution d'un livreur 🛵");
      refresh();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const quickSave = async (p: PublicProduct, patch: Partial<PublicProduct>) => {
    try {
      await api("productSave", { id: p.id, name: p.name, description: p.description, price: p.price, emoji: p.emoji, stock: p.stock, available: p.available, ...patch });
      refresh();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const saveShop = async () => {
    if (!shop) return;
    setBusy(true);
    try {
      await api("merchantUpdate", shop);
      toast("Boutique mise à jour.");
      refresh();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const deleteProduct = async () => {
    if (!del) return;
    setBusy(true);
    try {
      await api("productDelete", { id: del.id });
      toast("Produit supprimé.", "info");
      setDel(null);
      refresh();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  if (!data || !shop) return <div className="space-y-4"><div className="skeleton h-32" /><div className="skeleton h-80" /></div>;

  const incoming = data.orders.filter((o) => o.status === "payee");
  const inProgress = data.orders.filter((o) => ["acceptee", "preparation"].includes(o.status));
  const waiting = data.orders.filter((o) => ["prete", "recuperee", "en_livraison"].includes(o.status));
  const history = data.orders.filter((o) => ["livree", "annulee", "refusee"].includes(o.status)).slice(0, 15);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ventes du jour" value={euro(data.stats.today)} icon="📅" />
        <Stat label="Ventes 7 jours" value={euro(data.stats.week)} icon="📈" />
        <Stat label="À vous reverser" value={euro(data.stats.owed)} icon="🏦" tone="text-leaf" sub="Reversement via PSP agréé" />
        <Stat label="Commandes livrées" value={data.stats.deliveredCount} icon="📦" />
      </div>

      <Tabs
        tabs={[
          { id: "commandes", label: "🧾 Commandes", badge: incoming.length },
          { id: "produits", label: "🛍️ Produits" },
          { id: "boutique", label: "🏪 Boutique" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "commandes" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-xl font-black">Nouvelles commandes {incoming.length > 0 && <Badge tone="vermillon">{incoming.length}</Badge>}</h2>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {incoming.length === 0 && <EmptyState emoji="🔔" title="Aucune nouvelle commande" text="Les commandes payées arrivent ici en temps réel, sans rechargement. Astuce démo : commandez Chez Marcel depuis le compte camille." />}
              {incoming.map((o) => <NewOrderCard key={o.id} o={o} onAction={onAction} busy={busy} />)}
            </div>
          </div>
          {(inProgress.length > 0 || waiting.length > 0) && (
            <div>
              <h2 className="font-display text-xl font-black">En cours</h2>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                {[...inProgress, ...waiting].map((o) => (
                  <div key={o.id} className="card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-extrabold">{o.code} · {o.clientName}</p>
                      <StatusChip status={o.status} />
                    </div>
                    <p className="mt-2 text-sm text-ink-soft">{o.items.map((i) => `${i.emoji} ${i.name} ×${i.qty}`).join(" · ")}</p>
                    <p className="mt-1 text-xs font-bold text-ink-soft">⏱ Préparation annoncée : {o.prepMinutes} min · 🏠 {o.address}</p>
                    <div className="mt-3 flex gap-2">
                      {o.status === "acceptee" && <button disabled={busy} className="btn-river !text-xs" onClick={() => onAction("merchantPreparing", { orderId: o.id })}>👨‍🍳 Lancer la préparation</button>}
                      {(o.status === "preparation" || o.status === "acceptee") && <button disabled={busy} className="btn-leaf !text-xs" onClick={() => onAction("merchantReady", { orderId: o.id })}>✅ Commande prête</button>}
                      {o.status === "prete" && <span className="text-xs font-bold text-ambre">{o.courierId ? "🛵 Livreur en approche du commerce" : "🔎 Recherche d'un livreur dans le secteur…"}</span>}
                      {(o.status === "recuperee" || o.status === "en_livraison") && <span className="text-xs font-bold text-river">🛵 En cours de livraison chez le client</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="card p-5">
            <p className="font-display text-lg font-black">Historique</p>
            <div className="mt-2 divide-y divide-line/70">
              {history.length === 0 && <p className="py-3 text-sm text-ink-soft">Aucune commande clôturée.</p>}
              {history.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="font-extrabold">{o.code}</span>
                  <span className="flex-1 truncate text-ink-soft">{o.clientName} · {o.items.reduce((s, i) => s + i.qty, 0)} art.</span>
                  <span className="text-xs font-bold text-ink-soft">{fmtDateTime(o.createdAt)}</span>
                  <span className="font-black tabular-nums">{euro(o.itemsTotal)}</span>
                  <StatusChip status={o.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "produits" && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <p className="font-display text-lg font-black">Catalogue · {data.products.length} produits</p>
              <p className="text-xs text-ink-soft">Prix, stocks et disponibilité en direct — le commerçant reste seul maître de sa politique tarifaire.</p>
            </div>
            <button className="btn-leaf" onClick={() => setModal({ open: true, product: null })}>+ Nouveau produit</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-paper/70"><tr><th className="th">Produit</th><th className="th">Prix TTC</th><th className="th">Stock</th><th className="th">Disponible</th><th className="th"></th></tr></thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.id} className="border-t border-line/60 hover:bg-paper/40">
                    <td className="td"><span className="mr-2 text-xl">{p.emoji}</span><span className="font-extrabold">{p.name}</span><span className="block text-xs text-ink-soft">{p.description}</span></td>
                    <td className="td font-black tabular-nums">{euro(p.price)}</td>
                    <td className="td"><Stepper small value={p.stock} min={0} max={999} onChange={(v) => quickSave(p, { stock: v })} /></td>
                    <td className="td"><Toggle checked={p.available} onChange={(v) => quickSave(p, { available: v })} /></td>
                    <td className="td">
                      <div className="flex justify-end gap-1.5">
                        <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" onClick={() => setModal({ open: true, product: p })}>✏️</button>
                        <button className="btn-ghost !px-2.5 !py-1.5 !text-xs !text-danger !border-danger/30" onClick={() => setDel(p)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "boutique" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="card space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de la boutique"><input className="input" value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} /></Field>
              <Field label="Adresse"><input className="input" value={shop.address} onChange={(e) => setShop({ ...shop, address: e.target.value })} /></Field>
            </div>
            <Field label="Description"><textarea className="input min-h-24" value={shop.description} onChange={(e) => setShop({ ...shop, description: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ouverture">
                <select className="input" value={shop.openHour} onChange={(e) => setShop({ ...shop, openHour: Number(e.target.value) })}>
                  {[...Array(24)].map((_, h) => <option key={h} value={h}>{h}h</option>)}
                </select>
              </Field>
              <Field label="Fermeture">
                <select className="input" value={shop.closeHour} onChange={(e) => setShop({ ...shop, closeHour: Number(e.target.value) })}>
                  {[...Array(24)].map((_, h) => <option key={h} value={h}>{h}h</option>)}
                </select>
              </Field>
            </div>
            <div>
              <span className="label">Jours d'ouverture</span>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setShop({ ...shop, days: shop.days.includes(k) ? shop.days.replace(k, "") : shop.days + k })} className={`chip !px-3 !py-1.5 !text-[11px] ${shop.days.includes(k) ? "chip-active" : ""}`}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Logo (emoji)</span>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => setShop({ ...shop, emoji: e })} className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl transition cursor-pointer ${shop.emoji === e ? "border-vermillon bg-vermillon/10" : "border-line hover:border-ink/40"}`}>{e}</button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Couverture</span>
              <div className="flex flex-wrap gap-2">
                {COVERS.map((cv) => (
                  <button key={cv} type="button" onClick={() => setShop({ ...shop, cover: cv })} className={`cover-${cv} h-10 w-16 rounded-xl border-2 transition cursor-pointer ${shop.cover === cv ? "border-ink scale-105" : "border-transparent opacity-70 hover:opacity-100"}`} aria-label={cv} />
                ))}
              </div>
            </div>
            <button onClick={saveShop} disabled={busy} className="btn-leaf">{busy ? <Spinner /> : "Enregistrer la boutique"}</button>
          </div>
          <div className="space-y-4">
            <div className="card overflow-hidden">
              <div className={`cover-${shop.cover} grain relative flex h-28 items-center justify-center`}>
                <span className="relative text-5xl">{shop.emoji}</span>
              </div>
              <div className="p-4">
                <p className="font-display text-lg font-black">{shop.name}</p>
                <p className="text-xs font-bold text-ink-soft">Aperçu client · {hoursLabel(shop.openHour, shop.closeHour)}</p>
                <p className="mt-2 line-clamp-3 text-xs text-ink-soft">{shop.description}</p>
              </div>
            </div>
            <div className="card p-4 text-xs leading-relaxed text-ink-soft">
              <p className="font-extrabold text-ink">📜 Vos documents</p>
              {(data.merchant.docs ?? []).map((d, i) => <p key={i} className="mt-1.5">📄 {d.name}{d.expires && <span className="text-ambre"> · expire le {d.expires}</span>}</p>)}
              <p className="mt-2">L'administration contrôle les pièces arrivant à expiration et peut demander des justificatifs à jour.</p>
            </div>
          </div>
        </div>
      )}

      <ProductModal open={modal.open} product={modal.product} onClose={() => setModal({ open: false, product: null })} onSaved={refresh} />
      <Modal open={!!del} onClose={() => setDel(null)} title="Supprimer ce produit ?">
        <p className="text-sm text-ink-soft">« {del?.name} » sera retiré du catalogue. Les commandes déjà passées ne sont pas affectées.</p>
        <div className="mt-4 flex gap-2">
          <button onClick={deleteProduct} disabled={busy} className="btn-danger flex-1">Supprimer</button>
          <button onClick={() => setDel(null)} className="btn-ghost flex-1">Annuler</button>
        </div>
      </Modal>
    </div>
  );
}

export default function CommercantPage() {
  const me = usePoll<MeData>("me", {}, 8000);
  const pub = usePoll<PublicData>("public", {}, 60000);
  const [showApply, setShowApply] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const u = me.data?.user;

  useEffect(() => {
    if (window.location.search.includes("apply")) setShowApply(true);
  }, []);

  const demoLogin = async () => {
    setSwitching(true);
    try {
      await api("login", { pseudo: "marcel", password: "demo1234" });
      toast("Connecté en tant que Marcel (Chez Marcel) 🍲");
      me.refresh();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setSwitching(false);
    }
  };

  const resubmit = async () => {
    try {
      await api("resubmitDocs", { docs });
      toast("Documents envoyés ✔");
      window.location.reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {!me.data ? (
        <div className="space-y-4"><div className="skeleton h-48" /><div className="skeleton h-80" /></div>
      ) : !u || (u.role !== "commercant" && !showApply) ? (
        <>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-leaf via-[#237a45] to-[#14532d] p-8 text-cream grain sm:p-12">
            <span className="absolute -right-6 -bottom-10 text-[160px] opacity-15">🏪</span>
            <p className="relative text-[11px] font-extrabold uppercase tracking-[0.22em] text-cream/60">Espace commerçant · Loches (37)</p>
            <h1 className="relative mt-3 max-w-2xl font-display text-4xl font-black leading-tight sm:text-5xl">Vendez plus loin, sans céder un centime.</h1>
            <p className="relative mt-4 max-w-xl text-[15px] leading-relaxed text-cream/80">
              Boutique, produits, prix, stocks, horaires : vous gérez tout. La plateforme ne prend aucune commission sur vos
              produits — elle vit uniquement sur les frais de livraison payés par le client.
            </p>
            <div className="relative mt-6 flex flex-wrap gap-3">
              <button onClick={() => setShowApply(true)} className="btn bg-cream text-leaf hover:bg-paper">Inscrire mon commerce →</button>
              <button onClick={demoLogin} disabled={switching} className="btn border border-cream/40 text-cream hover:bg-cream/10">{switching ? <Spinner /> : "Compte démo : marcel / demo1234"}</button>
            </div>
            <div className="relative mt-8 grid max-w-2xl gap-3 text-[12px] font-extrabold sm:grid-cols-3">
              <span className="rounded-xl bg-cream/10 px-4 py-3">💶 100 % du prix de vos produits vous revient</span>
              <span className="rounded-xl bg-cream/10 px-4 py-3">🧾 Acceptation, préparation, prête : en 3 clics</span>
              <span className="rounded-xl bg-cream/10 px-4 py-3">🛵 Livreurs gérés par la plateforme</span>
            </div>
          </div>
          {u && u.role !== "commercant" && (
            <p className="mt-4 rounded-xl border border-line bg-cream px-4 py-3 text-sm font-bold text-ink-soft">
              Connecté en tant que <Badge tone="vermillon">{u.role}</Badge> — l'espace commerçant nécessite un compte boutique validé.
            </p>
          )}
        </>
      ) : u.role === "commercant" && u.status !== "active" ? (
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="card p-6">
            <PageHead
              kicker="Demande d'inscription"
              title={u.status === "pending" ? "Boutique en cours de validation" : u.status === "docs_required" ? "Justificatifs complémentaires requis" : u.status === "refused" ? "Demande refusée" : "Boutique suspendue"}
              sub="Votre boutique devient visible par les clients dès validation administrative."
            />
            {u.statusNote && <div className="rounded-xl border border-ambre/50 bg-ambre/10 px-4 py-3 text-sm font-bold text-[#8a5a00]">💬 {u.statusNote}</div>}
            <div className="mt-4">
              <p className="label">Pièces déposées</p>
              {((u.profile.docs as DocEntry[]) ?? []).map((d, i) => <p key={i} className="mt-1 rounded-lg bg-paper px-3 py-2 text-xs font-bold">📄 {d.name} · {d.fileName}</p>)}
            </div>
          </div>
          {u.status === "docs_required" && (
            <div className="card p-6">
              <p className="font-display text-lg font-black">Compléter mon dossier</p>
              <div className="mt-3 space-y-2">
                <DocInput label="Justificatif demandé" docs={docs} setDocs={setDocs} />
                <DocInput label="Autre document" docs={docs} setDocs={setDocs} />
              </div>
              <button onClick={resubmit} disabled={docs.length === 0} className="btn-leaf mt-4 w-full">Renvoyer mon dossier</button>
            </div>
          )}
        </div>
      ) : u.role === "commercant" ? (
        <>
          <PageHead
            kicker="Espace commerçant"
            title={<>{me.data.merchant?.emoji} {me.data.merchant?.name ?? u.displayName}</>}
            sub={`Boutique ${me.data.merchant && merchantOpen(me.data.merchant) ? "ouverte" : "fermée"} · ${me.data.merchant ? hoursLabel(me.data.merchant.openHour, me.data.merchant.closeHour) : ""} · synchronisation en temps réel`}
            right={<Badge tone={me.data.merchant && merchantOpen(me.data.merchant) ? "leaf" : "soft"}>{me.data.merchant && merchantOpen(me.data.merchant) ? "● Ouverte" : "Fermée"}</Badge>}
          />
          <Dashboard />
        </>
      ) : null}

      {showApply && (!u || u.role !== "commercant") && (
        <div className="mt-8">
          <PageHead kicker="Inscription" title="Rejoindre les commerces partenaires" sub="Dossier vérifié par l'administration : existence légale, assurances, autorisations du secteur." />
          <ApplyForm categories={pub.data?.config.categories ?? Object.keys(CATEGORY_META)} />
        </div>
      )}
    </div>
  );
}
