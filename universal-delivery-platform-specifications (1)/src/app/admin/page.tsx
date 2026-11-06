"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, usePoll, toast } from "@/lib/client";
import type { MeData, AdminData, SafeUser, CourierRow, MerchantRow, AdminOrder, AdminDispute, AdminCourier, AdminMerchant } from "@/lib/admin-types";
import type { Config, DocEntry } from "@/lib/util";
import { euro, fmtDateTime, timeAgo, computeFee, feeTotal, CATEGORY_META, VEHICLES, statusLabel } from "@/lib/util";
import { Badge, Field, Modal, PageHead, Spinner, StatusChip, Stat, Toggle, EmptyState } from "@/components/ui";
import MapView from "@/components/MapView";
import { AreaChart, Bars, Donut } from "@/components/Charts";

function EuroInput({ value, onChange }: { value: number; onChange: (cents: number) => void }) {
  return (
    <input
      className="input"
      type="number"
      step="0.1"
      min="0"
      value={(value / 100).toFixed(2)}
      onChange={(e) => onChange(Math.round(parseFloat(e.target.value || "0") * 100))}
    />
  );
}

function DocViewer({ doc, onClose }: { doc: DocEntry | null; onClose: () => void }) {
  return (
    <Modal open={!!doc} onClose={onClose} title={doc?.name ?? ""}>
      <div className="rounded-xl border border-line bg-paper p-6">
        <div className="mx-auto max-w-sm rounded-lg border border-line bg-cream p-6 shadow-inner">
          <p className="text-center text-4xl">📄</p>
          <p className="mt-3 text-center font-display text-lg font-black">{doc?.name}</p>
          <p className="mt-1 text-center text-xs font-bold text-ink-soft">{doc?.fileName}</p>
          <div className="mt-4 space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-2 rounded bg-ink/8" style={{ width: `${90 - i * 12}%` }} />)}
          </div>
          {doc?.expires && <p className="mt-4 text-center text-xs font-bold text-ambre">Expire le {doc.expires}</p>}
          <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-widest text-ink-soft">Aperçu sécurisé — accès journalisé</p>
        </div>
        <p className="mt-4 text-center text-[11px] text-ink-soft">🔒 Document d'identité protégé : consultation restreinte aux administrateurs habilités, chaque accès est tracé.</p>
      </div>
    </Modal>
  );
}

function DecisionBox({ user, onDone }: { user: SafeUser; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const decide = async (decision: string) => {
    setBusy(true);
    try {
      await api("adminDecide", { userId: user.id, decision, note });
      toast("Décision enregistrée et notifiée.");
      onDone();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-4 space-y-3 border-t border-dashed border-line pt-4">
      <Field label="Note / documents attendus (obligatoire pour une demande de pièces)">
        <textarea className="input min-h-16" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. Merci de fournir une attestation d'assurance couvrant l'usage professionnel." />
      </Field>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => decide("accept")} className="btn-leaf flex-1 !text-xs">✅ Accepter</button>
        <button disabled={busy} onClick={() => decide("docs")} className="btn-river flex-1 !text-xs">📎 Demander des pièces</button>
        <button disabled={busy} onClick={() => decide("refuse")} className="btn-danger flex-1 !text-xs">✗ Refuser</button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const me = usePoll<MeData>("me", {}, 10000);
  const isAdmin = me.data?.user?.role === "admin";
  const { data, refresh } = usePoll<AdminData>("admin", {}, isAdmin ? 6000 : 3600000);
  const [tab, setTab] = useState("overview");
  const [subTab, setSubTab] = useState("livreurs");
  const [pseudo, setPseudo] = useState("admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [dossier, setDossier] = useState<(SafeUser & { courier: CourierRow | null; merchant: MerchantRow | null }) | null>(null);
  const [docView, setDocView] = useState<DocEntry | null>(null);
  const [reassign, setReassign] = useState<AdminOrder | null>(null);
  const [reassignCourier, setReassignCourier] = useState(0);
  const [cancelO, setCancelO] = useState<AdminOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("Problème opérationnel");
  const [resolve, setResolve] = useState<AdminDispute | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveRefund, setResolveRefund] = useState("0");
  const [resolveStatus, setResolveStatus] = useState("resolu");
  const [zoneView, setZoneView] = useState<AdminCourier | null>(null);
  const [mDocs, setMDocs] = useState<AdminMerchant | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [newZone, setNewZone] = useState("");

  useEffect(() => {
    if (data && !cfg) setCfg(JSON.parse(JSON.stringify(data.config)) as Config);
  }, [data, cfg]);

  const login = async (pw?: string) => {
    setBusy(true);
    try {
      await api("login", { pseudo, password: pw ?? password });
      toast("Bienvenue dans l'administration 🛡️");
      me.refresh();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: string, payload: Record<string, unknown>, msg: string) => {
    setBusy(true);
    try {
      await api(action, payload);
      toast(msg);
      refresh();
      return true;
    } catch (e) {
      toast((e as Error).message, "err");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!me.data) return <div className="mx-auto max-w-7xl px-4 py-10"><div className="skeleton h-64" /></div>;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-14">
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-br from-grape to-[#37217e] p-8 text-cream grain relative">
            <p className="relative text-4xl">🛡️</p>
            <h1 className="relative mt-3 font-display text-3xl font-black">Administration Locho</h1>
            <p className="relative mt-2 text-sm text-cream/75">Espace privé réservé aux comptes autorisés. Chaque action est enregistrée dans le journal d'audit.</p>
          </div>
          <form className="space-y-4 p-6" onSubmit={(e) => { e.preventDefault(); login(); }}>
            <Field label="Pseudonyme"><input className="input" value={pseudo} onChange={(e) => setPseudo(e.target.value)} /></Field>
            <Field label="Mot de passe"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></Field>
            <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? <Spinner /> : "Accéder au tableau de bord"}</button>
            <button type="button" className="btn-ghost w-full" onClick={() => login("loches37")} disabled={busy}>Compte démo : admin / loches37</button>
          </form>
        </div>
      </div>
    );
  }

  if (!data || !cfg) return <div className="mx-auto max-w-7xl px-4 py-10 space-y-4"><div className="skeleton h-40" /><div className="skeleton h-96" /></div>;

  const k = data.kpis;
  const applications = data.applications.filter((a) => (subTab === "livreurs" ? a.role === "livreur" : a.role === "commercant"));
  const filteredOrders = data.orders.filter((o) => (statusFilter === "all" || o.status === statusFilter) && (!blockedOnly || o.blocked));
  const exampleFee = computeFee(cfg, 3.2, "Restauration", true, 12);
  const exampleTotal = feeTotal(exampleFee);

  const TABS = [
    { id: "overview", label: "📊 Tableau de bord" },
    { id: "validations", label: "🗂 Validations", badge: data.applications.length },
    { id: "couriers", label: "🛵 Livreurs" },
    { id: "merchants", label: "🏪 Commerçants" },
    { id: "orders", label: "🧾 Commandes", badge: data.orders.filter((o) => o.blocked).length },
    { id: "disputes", label: "⚠️ Litiges", badge: k.disputesOpen },
    { id: "finance", label: "🏦 Finances", badge: k.payoutsPending },
    { id: "config", label: "⚙️ Configuration" },
    { id: "journal", label: "📜 Journal" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHead kicker="Espace administration" title="Tour de contrôle de la Cité" sub="Inscriptions, opérations, finances et règles du service — chaque intervention est journalisée." right={<Badge tone="grape">🛡️ {me.data.user?.displayName}</Badge>} />

      <div className="flex gap-1.5 overflow-x-auto pb-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`chip ${tab === t.id ? "chip-active" : ""}`}>
            {t.label}
            {!!t.badge && t.badge > 0 && <span className={`rounded-full px-1.5 text-[10px] ${tab === t.id ? "bg-cream/25" : "bg-vermillon text-cream"}`}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ================= VUE D'ENSEMBLE ================= */}
      {tab === "overview" && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Stat label="Clients inscrits" value={k.clients} icon="👥" />
            <Stat label="Livreurs inscrits" value={k.couriers} icon="🛵" sub={`${k.couriersActive} actifs en ligne`} />
            <Stat label="Commerçants" value={k.merchants} icon="🏪" />
            <Stat label="Commandes en cours" value={k.ordersActive} icon="⏳" tone="text-river" />
            <Stat label="Commandes terminées" value={k.ordersDone} icon="✅" tone="text-leaf" />
            <Stat label="Chiffre d'affaires" value={euro(k.ca)} icon="💶" />
            <Stat label="Revenus plateforme" value={euro(k.platformRevenue)} icon="🏦" tone="text-vermillon-deep" />
            <Stat label="Dû aux livreurs" value={euro(k.owedCouriers)} icon="🛵" tone="text-river" />
            <Stat label="Dû aux commerçants" value={euro(k.owedMerchants)} icon="🏪" tone="text-leaf" />
            <Stat label="Litiges ouverts" value={k.disputesOpen} icon="⚠️" tone={k.disputesOpen ? "text-danger" : "text-ink"} />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <p className="font-display text-lg font-black">Chiffre d'affaires livré · 14 jours</p>
              <AreaChart values={data.series.map((s) => s.amount / 100)} labels={data.series.map((s) => s.day)} color="#E4572E" format={(v) => euro(Math.round(v * 100))} />
              <p className="mt-4 label">Commandes livrées par jour</p>
              <Bars values={data.series.map((s) => s.count)} labels={data.series.map((s) => s.day)} color="#2667FF" height={90} format={(v) => `${v} cmd`} />
            </div>
            <div className="space-y-4">
              <div className="card p-5">
                <p className="font-display text-base font-black">Répartition des frais</p>
                <div className="mt-3">
                  <Donut parts={[{ label: "Livreurs", value: cfg.courierSharePercent, color: "#2667FF" }, { label: "Plateforme", value: 100 - cfg.courierSharePercent, color: "#E4572E" }]} centerLabel={`${cfg.courierSharePercent}%`} centerSub="livreurs" size={130} />
                </div>
                <p className="mt-2 text-[11px] text-ink-soft">0 % de commission sur les produits — revenus uniquement sur la livraison.</p>
              </div>
              <div className="card p-5">
                <p className="font-display text-base font-black">Livreurs en ligne</p>
                <div className="mt-2 space-y-2">
                  {data.couriers.filter((c) => c.online).map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-xs font-bold">
                      <span className="h-2 w-2 rounded-full bg-leaf dot-live" />
                      <span className="flex-1">{c.name}</span>
                      <span>{VEHICLES[c.vehicle]?.emoji}</span>
                      <Badge tone="river">{c.active}/{c.capacity}</Badge>
                    </div>
                  ))}
                  {data.couriers.filter((c) => c.online).length === 0 && <p className="text-xs text-ink-soft">Aucun livreur connecté.</p>}
                </div>
              </div>
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <p className="font-display text-lg font-black">Carte opérationnelle</p>
              <p className="text-[11px] font-bold text-ink-soft">Vue admin : commerces + livreurs connectés (jamais visible des clients)</p>
            </div>
            <MapView
              className="h-80 !rounded-none !border-0"
              center={[47.1289, 0.9973]}
              zoom={13}
              markers={[
                ...data.merchants.map((m) => ({ id: `m${m.id}`, lat: m.lat, lng: m.lng, kind: "shop" as const, emoji: m.emoji, label: m.name })),
                ...data.couriers.filter((c) => c.online).map((c) => ({ id: `c${c.id}`, lat: c.lat, lng: c.lng, kind: "courier" as const, emoji: VEHICLES[c.vehicle]?.emoji ?? "🛵", label: `${c.name} · ${c.active}/${c.capacity}` })),
              ]}
              circle={{ lat: 47.1289, lng: 0.9973, km: cfg.maxRadiusKm }}
            />
          </div>
        </div>
      )}

      {/* ================= VALIDATIONS ================= */}
      {tab === "validations" && (
        <div className="mt-6 space-y-4">
          <div className="flex gap-1.5">
            {[["livreurs", "🛵 Demande de livreurs"], ["commercants", "🏪 Demande de commerçants"], ["clients", "👥 Comptes clients"]].map(([id, l]) => (
              <button key={id} onClick={() => setSubTab(id)} className={`chip ${subTab === id ? "chip-active" : ""}`}>{l}</button>
            ))}
          </div>
          {subTab !== "clients" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {applications.length === 0 && <div className="md:col-span-2"><EmptyState emoji="🗂" title="Aucun dossier en attente" text="Les nouvelles candidatures arrivent ici automatiquement." /></div>}
              {applications.map((a) => (
                <div key={a.id} className="card p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-lg font-black">{a.role === "livreur" ? "🛵" : "🏪"} {a.merchant?.name ?? a.displayName}</p>
                    <Badge tone={a.status === "docs_required" ? "ambre" : "river"}>{a.status === "docs_required" ? "Pièces attendues" : "En attente"}</Badge>
                  </div>
                  <p className="mt-1 text-xs font-bold text-ink-soft">{a.displayName} · {a.email} · {timeAgo(a.createdAt)}</p>
                  <p className="mt-1 text-xs text-ink-soft">{a.role === "livreur" ? `${String(a.profile.statut ?? "")} · ${VEHICLES[a.courier?.vehicle ?? ""]?.label ?? ""} · SIREN ${String(a.profile.siren ?? "—")}` : `${a.merchant?.category ?? ""} · SIRET ${a.merchant?.siret ?? "—"}`}</p>
                  <p className="mt-2 text-xs font-bold text-ink-soft">📎 {((a.profile.docs as DocEntry[]) ?? []).length} pièce(s) déposée(s)</p>
                  <button className="btn-ink mt-3 w-full !text-xs" onClick={() => setDossier(a)}>Consulter le dossier →</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="bg-paper/70"><tr><th className="th">Client</th><th className="th">Commandes</th><th className="th">Statut</th><th className="th">Actions</th></tr></thead>
                <tbody>
                  {data.clients.map((cl) => (
                    <tr key={cl.id} className="border-t border-line/60">
                      <td className="td"><span className="font-extrabold">{cl.displayName || cl.pseudo}</span><span className="block text-xs text-ink-soft">@{cl.pseudo} · inscrit {timeAgo(cl.createdAt)}</span></td>
                      <td className="td tabular-nums font-bold">{cl.ordersCount}</td>
                      <td className="td"><Badge tone={cl.status === "active" ? "leaf" : cl.status === "suspended" ? "ambre" : "danger"}>{cl.status}</Badge></td>
                      <td className="td">
                        <div className="flex gap-1.5">
                          {cl.status === "active" ? (
                            <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" onClick={() => act("adminDecide", { userId: cl.id, decision: "suspend", note: "Suspension administrative" }, "Compte suspendu.")}>Suspendre</button>
                          ) : cl.status === "suspended" ? (
                            <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" onClick={() => act("adminDecide", { userId: cl.id, decision: "reactivate", note: "" }, "Compte réactivé.")}>Réactiver</button>
                          ) : null}
                          {cl.status !== "disabled" && (
                            <button className="btn-ghost !px-2.5 !py-1.5 !text-xs !text-danger !border-danger/30" onClick={() => act("adminDecide", { userId: cl.id, decision: "disable", note: "Suppression administrative (RGPD)" }, "Compte désactivé.")}>Supprimer</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= LIVREURS ================= */}
      {tab === "couriers" && (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-paper/70"><tr><th className="th">Livreur</th><th className="th">Secteur</th><th className="th">Capacité</th><th className="th">Livrées</th><th className="th">Gains cumulés</th><th className="th">Solde dû</th><th className="th">Statut</th><th className="th"></th></tr></thead>
            <tbody>
              {data.couriers.map((c) => (
                <tr key={c.id} className="border-t border-line/60 hover:bg-paper/40">
                  <td className="td">
                    <span className="flex items-center gap-2 font-extrabold"><span className={`h-2 w-2 rounded-full ${c.online ? "bg-leaf dot-live" : "bg-ink/20"}`} />{c.name}</span>
                    <span className="text-xs text-ink-soft">{VEHICLES[c.vehicle]?.emoji} {VEHICLES[c.vehicle]?.label}{c.isBot && " · simulé"}</span>
                  </td>
                  <td className="td text-xs font-bold">{c.radiusKm} km <button className="ml-1 text-river underline" onClick={() => setZoneView(c)}>voir</button></td>
                  <td className="td"><Badge tone={c.remaining > 0 ? "river" : "soft"}>{c.active}/{c.capacity} · {c.remaining} restante(s)</Badge></td>
                  <td className="td font-bold tabular-nums">{c.delivered}</td>
                  <td className="td font-bold tabular-nums">{euro(c.earned)}</td>
                  <td className="td font-black tabular-nums text-river">{euro(c.available)}</td>
                  <td className="td"><Badge tone={c.status === "active" ? "leaf" : c.status === "pending" ? "ambre" : "danger"}>{c.status}</Badge></td>
                  <td className="td">
                    {c.status === "active" ? (
                      <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" onClick={() => act("adminDecide", { userId: c.userId, decision: "suspend", note: "Suspension administrative" }, "Livreur suspendu.")}>Suspendre</button>
                    ) : (
                      <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" onClick={() => act("adminDecide", { userId: c.userId, decision: "reactivate", note: "" }, "Livreur réactivé.")}>Réactiver</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= COMMERÇANTS ================= */}
      {tab === "merchants" && (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-paper/70"><tr><th className="th">Boutique</th><th className="th">Produits</th><th className="th">CA produits</th><th className="th">À reverser</th><th className="th">Documents</th><th className="th">Statut</th><th className="th">Actions</th></tr></thead>
            <tbody>
              {data.merchants.map((m) => {
                const expSoon = (m.docs ?? []).some((d) => d.expires && new Date(d.expires).getTime() < Date.now() + 90 * 86400000);
                return (
                  <tr key={m.id} className="border-t border-line/60 hover:bg-paper/40">
                    <td className="td"><span className="font-extrabold">{m.emoji} {m.name}</span><span className="block text-xs text-ink-soft">{m.category} · {m.legalName} · SIRET {m.siret}</span></td>
                    <td className="td font-bold tabular-nums">{m.products}</td>
                    <td className="td font-bold tabular-nums">{euro(m.revenue)}</td>
                    <td className="td font-black tabular-nums text-leaf">{euro(m.owed)}</td>
                    <td className="td">
                      <button className={`btn-ghost !px-2.5 !py-1.5 !text-xs ${expSoon ? "!border-ambre !text-[#8a5a00]" : ""}`} onClick={() => setMDocs(m)}>
                        📎 {(m.docs ?? []).length}{expSoon && " · expire bientôt"}
                      </button>
                    </td>
                    <td className="td"><Badge tone={m.status === "active" ? (m.open ? "leaf" : "soft") : m.status === "pending" ? "ambre" : "danger"}>{m.status === "active" ? (m.open ? "Ouverte" : "Fermée") : m.status}</Badge></td>
                    <td className="td">
                      <div className="flex gap-1.5">
                        {m.owed > 0 && <button className="btn-leaf !px-2.5 !py-1.5 !text-xs" onClick={() => act("adminSettleMerchant", { merchantId: m.id }, `Reversement de ${euro(m.owed)} effectué.`)}>Reverser</button>}
                        {m.status === "active" ? (
                          <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" onClick={() => act("adminDecide", { userId: m.userId, decision: "suspend", note: "Boutique suspendue" }, "Boutique suspendue.")}>Suspendre</button>
                        ) : m.status !== "pending" ? (
                          <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" onClick={() => act("adminDecide", { userId: m.userId, decision: "reactivate", note: "" }, "Boutique réactivée.")}>Réactiver</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= COMMANDES ================= */}
      {tab === "orders" && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select className="input !w-56" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tous les états</option>
              {["payee", "acceptee", "preparation", "prete", "recuperee", "en_livraison", "livree", "annulee", "refusee"].map((st) => <option key={st} value={st}>{statusLabel(st as never)}</option>)}
            </select>
            <Toggle checked={blockedOnly} onChange={setBlockedOnly} label="Commandes bloquées uniquement" />
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="bg-paper/70"><tr><th className="th">Commande</th><th className="th">Client</th><th className="th">Commerce</th><th className="th">Livreur</th><th className="th">État</th><th className="th">Total</th><th className="th">Actions</th></tr></thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o.id} className={`border-t border-line/60 ${o.blocked ? "bg-danger/5" : "hover:bg-paper/40"}`}>
                    <td className="td"><span className="font-extrabold">{o.code}</span>{o.blocked && <Badge tone="danger" className="ml-1.5">bloquée</Badge>}<span className="block text-xs text-ink-soft">{fmtDateTime(o.createdAt)}</span></td>
                    <td className="td text-xs font-bold">{o.clientName}</td>
                    <td className="td text-xs font-bold">{o.merchantName}</td>
                    <td className="td text-xs font-bold">{o.courierName ?? "—"}</td>
                    <td className="td"><StatusChip status={o.status} /></td>
                    <td className="td font-black tabular-nums">{euro(o.total)}</td>
                    <td className="td">
                      <div className="flex gap-1.5">
                        <Link href={`/commande/${o.id}`} className="btn-ghost !px-2.5 !py-1.5 !text-xs">👁</Link>
                        {o.status === "prete" && <button className="btn-river !px-2.5 !py-1.5 !text-xs" onClick={() => { setReassign(o); setReassignCourier(0); }}>Réattribuer</button>}
                        {!["livree", "annulee", "refusee"].includes(o.status) && <button className="btn-ghost !px-2.5 !py-1.5 !text-xs !text-danger !border-danger/30" onClick={() => setCancelO(o)}>Annuler</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOrders.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-soft">Aucune commande ne correspond à ce filtre.</p>}
          </div>
        </div>
      )}

      {/* ================= LITIGES ================= */}
      {tab === "disputes" && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {data.disputes.length === 0 && <div className="md:col-span-2"><EmptyState emoji="🕊️" title="Aucune réclamation" text="Les signalements clients arrivent ici avec le motif et le détail." /></div>}
          {data.disputes.map((d) => (
            <div key={d.id} className="card p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-lg font-black">{d.reason}</p>
                <Badge tone={d.status === "resolu" ? "leaf" : d.status === "rejete" ? "danger" : d.status === "en_cours" ? "river" : "ambre"}>{d.status}</Badge>
              </div>
              <p className="mt-1 text-xs font-bold text-ink-soft">{d.orderCode} · {d.clientName} · {euro(d.orderTotal)} · {timeAgo(d.createdAt)}</p>
              {d.details && <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-sm text-ink-soft">« {d.details} »</p>}
              {d.decision && <p className="mt-2 text-sm font-bold">Décision : {d.decision}</p>}
              {(d.status === "ouvert" || d.status === "en_cours") && (
                <button className="btn-primary mt-3 w-full !text-xs" onClick={() => { setResolve(d); setResolveNote(""); setResolveRefund("0"); setResolveStatus("resolu"); }}>Traiter la réclamation</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ================= FINANCES ================= */}
      {tab === "finance" && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Dû aux livreurs" value={euro(k.owedCouriers)} icon="🛵" tone="text-river" />
            <Stat label="Dû aux commerçants" value={euro(k.owedMerchants)} icon="🏪" tone="text-leaf" />
            <Stat label="Revenus plateforme" value={euro(k.platformRevenue)} icon="🏦" tone="text-vermillon-deep" />
          </div>
          <div className="card p-5">
            <p className="font-display text-lg font-black">Demandes de versement des livreurs</p>
            <div className="mt-3 divide-y divide-line/70">
              {data.payouts.length === 0 && <p className="py-3 text-sm text-ink-soft">Aucune demande.</p>}
              {data.payouts.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="font-extrabold">{p.courierName}</span>
                  <span className="text-xs font-bold text-ink-soft">{fmtDateTime(p.createdAt)}</span>
                  <span className="ml-auto font-black tabular-nums">{euro(p.amount)}</span>
                  {p.status === "demande" ? (
                    <div className="flex gap-1.5">
                      <button disabled={busy} className="btn-leaf !px-3 !py-1.5 !text-xs" onClick={() => act("adminPayout", { payoutId: p.id, approve: true }, "Versement effectué (PSP démo).")}>✓ Verser</button>
                      <button disabled={busy} className="btn-ghost !px-3 !py-1.5 !text-xs !text-danger !border-danger/30" onClick={() => act("adminPayout", { payoutId: p.id, approve: false }, "Demande refusée.")}>Refuser</button>
                    </div>
                  ) : (
                    <Badge tone={p.status === "verse" ? "leaf" : "danger"}>{p.status === "verse" ? "Versé" : "Refusé"}</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-cream px-5 py-4 text-[12px] leading-relaxed text-ink-soft">
            🧾 <strong>Traçabilité intégrale :</strong> chaque commande génère un paiement client, la part produits du commerçant (sans marge),
            la part livreur et la part plateforme. Remboursements, versements et reversements sont des écritures horodatées, consultables
            dans le journal. Les fonds transitent par un prestataire de paiement agréé multi-vendeurs — jamais par la plateforme (mode démonstration).
          </div>
        </div>
      )}

      {/* ================= CONFIGURATION ================= */}
      {tab === "config" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <div className="card space-y-4 p-6">
              <p className="font-display text-lg font-black">🕓 Horaires & zones</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="Ouverture service"><select className="input" value={cfg.openHour} onChange={(e) => setCfg({ ...cfg, openHour: Number(e.target.value) })}>{[...Array(24)].map((_, h) => <option key={h} value={h}>{h}h</option>)}</select></Field>
                <Field label="Fermeture service"><select className="input" value={cfg.closeHour} onChange={(e) => setCfg({ ...cfg, closeHour: Number(e.target.value) })}>{[...Array(24)].map((_, h) => <option key={h} value={h}>{h}h</option>)}</select></Field>
                <Field label="Capacité max / livreur"><input className="input" type="number" min={1} max={20} value={cfg.maxCapacity} onChange={(e) => setCfg({ ...cfg, maxCapacity: Number(e.target.value) })} /></Field>
                <Field label="Rayon max (km)"><input className="input" type="number" min={1} max={30} value={cfg.maxRadiusKm} onChange={(e) => setCfg({ ...cfg, maxRadiusKm: Number(e.target.value) })} /></Field>
              </div>
              <div>
                <span className="label">Communes desservies</span>
                <div className="flex flex-wrap gap-1.5">
                  {cfg.zones.map((z) => (
                    <span key={z} className="chip !cursor-default">{z}<button className="ml-1 text-danger cursor-pointer" onClick={() => setCfg({ ...cfg, zones: cfg.zones.filter((x) => x !== z) })}>✕</button></span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input className="input" placeholder="Ajouter une commune (phase 3 : Perrusson, voisins…)" value={newZone} onChange={(e) => setNewZone(e.target.value)} />
                  <button className="btn-ghost" onClick={() => { if (newZone.trim()) { setCfg({ ...cfg, zones: [...cfg.zones, newZone.trim()] }); setNewZone(""); } }}>+ Ajouter</button>
                </div>
              </div>
            </div>

            <div className="card space-y-4 p-6">
              <p className="font-display text-lg font-black">💶 Tarifs de livraison</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Prix minimum"><EuroInput value={cfg.minFee} onChange={(v) => setCfg({ ...cfg, minFee: v })} /></Field>
                <Field label="Prise en charge"><EuroInput value={cfg.baseFee} onChange={(v) => setCfg({ ...cfg, baseFee: v })} /></Field>
                <Field label="Prix au km"><EuroInput value={cfg.perKm} onChange={(v) => setCfg({ ...cfg, perKm: v })} /></Field>
                <Field label="Supplément urgence"><EuroInput value={cfg.urgentSupplement} onChange={(v) => setCfg({ ...cfg, urgentSupplement: v })} /></Field>
                <Field label="Supplément horaire"><EuroInput value={cfg.nightSupplement} onChange={(v) => setCfg({ ...cfg, nightSupplement: v })} /></Field>
                <Field label="Versement minimum livreur"><EuroInput value={cfg.minPayout} onChange={(v) => setCfg({ ...cfg, minPayout: v })} /></Field>
                <Field label="Horaire étendu avant (h)"><input className="input" type="number" min={0} max={23} value={cfg.nightBefore} onChange={(e) => setCfg({ ...cfg, nightBefore: Number(e.target.value) })} /></Field>
                <Field label="Horaire étendu après (h)"><input className="input" type="number" min={0} max={23} value={cfg.nightAfter} onChange={(e) => setCfg({ ...cfg, nightAfter: Number(e.target.value) })} /></Field>
                <Field label="Promotion (%)"><input className="input" type="number" min={0} max={90} value={cfg.promoPercent} onChange={(e) => setCfg({ ...cfg, promoPercent: Number(e.target.value) })} /></Field>
              </div>
              <div>
                <span className="label">Suppléments par catégorie</span>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {cfg.categories.map((c) => (
                    <Field key={c} label={c}>
                      <EuroInput value={cfg.categorySupplements[c] ?? 0} onChange={(v) => setCfg({ ...cfg, categorySupplements: { ...cfg.categorySupplements, [c]: v } })} />
                    </Field>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="label !mb-0">Répartition des frais de livraison</span>
                  <span className="text-sm font-black text-river">{cfg.courierSharePercent} % livreur · {100 - cfg.courierSharePercent} % plateforme</span>
                </div>
                <input type="range" min={0} max={100} value={cfg.courierSharePercent} onChange={(e) => setCfg({ ...cfg, courierSharePercent: Number(e.target.value) })} className="mt-2 w-full accent-[#2667FF]" aria-label="Part livreur" />
              </div>
            </div>

            <div className="card space-y-3 p-6">
              <p className="font-display text-lg font-black">🗂 Catégories autorisées</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(CATEGORY_META).map((c) => (
                  <button key={c} onClick={() => setCfg({ ...cfg, categories: cfg.categories.includes(c) ? cfg.categories.filter((x) => x !== c) : [...cfg.categories, c] })} className={`chip ${cfg.categories.includes(c) ? "chip-active" : ""}`}>
                    {CATEGORY_META[c].emoji} {c}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-ink-soft">
                ⚖️ Restent exclus du catalogue ordinaire : {cfg.forbidden.join(" · ")}. Les livraisons de médicaments
                respecteront le rôle du pharmacien et le Code de la santé publique ; l'alcool suppose un contrôle d'âge et un cadre vérifié.
              </p>
            </div>
          </div>

          <div className="space-y-4 self-start lg:sticky lg:top-24">
            <div className="card bg-night !border-night p-5 text-cream grain relative overflow-hidden">
              <p className="relative font-display text-lg font-black">Simulation en direct</p>
              <p className="relative text-[11px] text-cream/60">Restauration · 3,2 km · urgente · midi</p>
              <div className="relative mt-3 space-y-1 text-[12px]">
                {exampleFee.lines.map((l, i) => (
                  <div key={i} className="flex justify-between"><span className="text-cream/70">{l.label}</span><span className="tabular-nums font-bold">{euro(l.amount)}</span></div>
                ))}
                <div className="flex justify-between border-t border-cream/15 pt-2 text-base font-black"><span>Client paie</span><span className="tabular-nums text-ambre">{euro(exampleTotal)}</span></div>
                <div className="flex justify-between text-river"><span>→ Livreur ({cfg.courierSharePercent} %)</span><span className="tabular-nums font-bold">{euro(exampleFee.courierShare)}</span></div>
                <div className="flex justify-between text-vermillon"><span>→ Plateforme</span><span className="tabular-nums font-bold">{euro(exampleFee.platformShare)}</span></div>
              </div>
            </div>
            <button
              className="btn-primary w-full !py-4"
              disabled={busy}
              onClick={async () => {
                const ok = await act("adminConfig", { config: cfg }, "Configuration enregistrée et journalisée.");
                if (ok) refresh();
              }}
            >
              {busy ? <Spinner /> : "💾 Enregistrer la configuration"}
            </button>
            <p className="text-center text-[11px] text-ink-soft">Les nouveaux tarifs s'appliquent aux prochaines commandes ; les tarifs payés restent inchangés.</p>
          </div>
        </div>
      )}

      {/* ================= JOURNAL ================= */}
      {tab === "journal" && (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-paper/70"><tr><th className="th">Date</th><th className="th">Action</th><th className="th">Cible</th><th className="th">Détails</th></tr></thead>
            <tbody>
              {data.logs.map((l) => (
                <tr key={l.id} className="border-t border-line/60">
                  <td className="td whitespace-nowrap text-xs font-bold text-ink-soft">{fmtDateTime(l.createdAt)}</td>
                  <td className="td font-extrabold">{l.action}</td>
                  <td className="td text-xs font-bold">{l.target}</td>
                  <td className="td text-xs text-ink-soft">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= MODALES ================= */}
      <Modal open={!!dossier} onClose={() => setDossier(null)} title={`Dossier · ${dossier?.merchant?.name ?? dossier?.displayName ?? ""}`} wide>
        {dossier && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <p className="label">Identité & contact</p>
              <p><strong>{dossier.displayName}</strong> · @{dossier.pseudo}</p>
              <p>✉️ {dossier.email || "—"} · 📞 {dossier.phone || "—"}</p>
              <p>🏠 {dossier.address || "—"}</p>
              {dossier.role === "livreur" && (
                <>
                  <p className="label pt-3">Situation professionnelle</p>
                  <p>Statut : <strong>{String(dossier.profile.statut ?? "—")}</strong></p>
                  <p>SIREN/SIRET : {String(dossier.profile.siren ?? "—")}</p>
                  <p>Naissance : {String(dossier.profile.birthDate ?? "—")}</p>
                  <p>IBAN : {String(dossier.profile.iban ?? "—")}</p>
                  <p className="label pt-3">Transport</p>
                  <p>Véhicule : {VEHICLES[dossier.courier?.vehicle ?? ""]?.emoji} {VEHICLES[dossier.courier?.vehicle ?? ""]?.label}</p>
                  {dossier.profile.immat ? <p>Immatriculation : {String(dossier.profile.immat)}</p> : null}
                  {dossier.profile.permis ? <p>Permis : {String(dossier.profile.permis)}</p> : null}
                  {dossier.profile.insuranceExp ? <p>Assurance pro jusqu'au : {String(dossier.profile.insuranceExp)}</p> : null}
                </>
              )}
              {dossier.role === "commercant" && dossier.merchant && (
                <>
                  <p className="label pt-3">Établissement</p>
                  <p>Raison sociale : <strong>{dossier.merchant.legalName}</strong></p>
                  <p>SIRET : {dossier.merchant.siret}</p>
                  <p>Catégorie : {dossier.merchant.category}</p>
                  <p>Horaires : {dossier.merchant.openHour}h–{dossier.merchant.closeHour}h</p>
                  <p>IBAN : {String(dossier.profile.iban ?? "—")}</p>
                </>
              )}
            </div>
            <div>
              <p className="label">Justificatifs déposés</p>
              <div className="space-y-2">
                {((dossier.profile.docs as DocEntry[]) ?? []).map((d, i) => (
                  <button key={i} onClick={() => setDocView(d)} className="flex w-full items-center justify-between rounded-xl border border-line bg-paper px-4 py-3 text-left text-sm font-bold transition hover:border-grape/50 cursor-pointer">
                    <span>📄 {d.name}</span><span className="text-xs text-river underline">Consulter</span>
                  </button>
                ))}
                {((dossier.profile.docs as DocEntry[]) ?? []).length === 0 && <p className="text-sm text-ink-soft">Aucune pièce déposée.</p>}
              </div>
              <DecisionBox user={dossier} onDone={() => { setDossier(null); refresh(); }} />
            </div>
          </div>
        )}
      </Modal>

      <DocViewer doc={docView} onClose={() => setDocView(null)} />

      <Modal open={!!zoneView} onClose={() => setZoneView(null)} title={`Secteur de ${zoneView?.name ?? ""}`}>
        {zoneView && (
          <>
            <MapView
              className="h-64"
              center={[zoneView.centerLat, zoneView.centerLng]}
              zoom={12}
              markers={[
                { id: "center", lat: zoneView.centerLat, lng: zoneView.centerLng, kind: "center", label: "Point central" },
                { id: "pos", lat: zoneView.lat, lng: zoneView.lng, kind: "courier", emoji: VEHICLES[zoneView.vehicle]?.emoji ?? "🛵", label: "Position actuelle" },
              ]}
              circle={{ lat: zoneView.centerLat, lng: zoneView.centerLng, km: zoneView.radiusKm }}
            />
            <p className="mt-3 text-sm font-bold text-ink-soft">Rayon {zoneView.radiusKm} km · capacité {zoneView.capacity} · {zoneView.active} en cours · {zoneView.delivered} livrées · gains {euro(zoneView.earned)}</p>
          </>
        )}
      </Modal>

      <Modal open={!!mDocs} onClose={() => setMDocs(null)} title={`Documents · ${mDocs?.name ?? ""}`}>
        <div className="space-y-2">
          {(mDocs?.docs ?? []).map((d, i) => (
            <button key={i} onClick={() => setDocView(d)} className="flex w-full items-center justify-between rounded-xl border border-line bg-paper px-4 py-3 text-left text-sm font-bold hover:border-grape/50 cursor-pointer">
              <span>📄 {d.name}{d.expires && <span className="block text-xs text-ambre">expire le {d.expires}</span>}</span>
              <span className="text-xs text-river underline">Consulter</span>
            </button>
          ))}
          {(mDocs?.docs ?? []).length === 0 && <p className="text-sm text-ink-soft">Aucun document.</p>}
        </div>
      </Modal>

      <Modal open={!!reassign} onClose={() => setReassign(null)} title={`Réattribuer ${reassign?.code ?? ""}`}>
        <Field label="Livreur disponible (capacité restante)">
          <select className="input" value={reassignCourier} onChange={(e) => setReassignCourier(Number(e.target.value))}>
            <option value={0}>Choisir un livreur…</option>
            {data.onlineCouriersForReassign.filter((c) => c.remaining > 0).map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {c.vehicle} · {c.remaining} place(s)</option>
            ))}
          </select>
        </Field>
        <button
          className="btn-river mt-4 w-full"
          disabled={busy || !reassignCourier}
          onClick={async () => {
            const ok = await act("adminReassign", { orderId: reassign?.id, courierId: reassignCourier }, "Commande réattribuée.");
            if (ok) setReassign(null);
          }}
        >
          Réattribuer la commande
        </button>
      </Modal>

      <Modal open={!!cancelO} onClose={() => setCancelO(null)} title={`Annuler ${cancelO?.code ?? ""}`}>
        <Field label="Motif (notifié au client et au commerçant)">
          <input className="input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </Field>
        <p className="mt-3 text-sm text-ink-soft">Le client sera intégralement remboursé ({cancelO ? euro(cancelO.total) : ""}) via le PSP. L'intervention sera journalisée.</p>
        <button
          className="btn-danger mt-4 w-full"
          disabled={busy}
          onClick={async () => {
            const ok = await act("adminCancel", { orderId: cancelO?.id, reason: cancelReason }, "Commande annulée et remboursée.");
            if (ok) setCancelO(null);
          }}
        >
          Annuler et rembourser
        </button>
      </Modal>

      <Modal open={!!resolve} onClose={() => setResolve(null)} title={`Litige · ${resolve?.reason ?? ""}`}>
        <div className="space-y-4">
          <p className="rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft">{resolve?.orderCode} · {resolve?.clientName} · commande de {resolve ? euro(resolve.orderTotal) : ""}{resolve?.details ? ` · « ${resolve.details} »` : ""}</p>
          <Field label="Décision / réponse au client">
            <textarea className="input min-h-20" value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} placeholder="ex. Produit manquant confirmé par le commerçant, remboursement de l'article." />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Remboursement (€)"><input className="input" type="number" step="0.1" min="0" value={resolveRefund} onChange={(e) => setResolveRefund(e.target.value)} /></Field>
            <Field label="Issue">
              <select className="input" value={resolveStatus} onChange={(e) => setResolveStatus(e.target.value)}>
                <option value="resolu">Résolu</option>
                <option value="rejete">Rejeté</option>
              </select>
            </Field>
          </div>
          <button
            className="btn-primary w-full"
            disabled={busy}
            onClick={async () => {
              const ok = await act("adminResolveDispute", { disputeId: resolve?.id, status: resolveStatus, note: resolveNote, refundAmount: Math.round(parseFloat(resolveRefund || "0") * 100) }, "Réclamation traitée, client notifié.");
              if (ok) setResolve(null);
            }}
          >
            Enregistrer la décision
          </button>
        </div>
      </Modal>
    </div>
  );
}
