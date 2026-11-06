"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, usePoll, toast } from "@/lib/client";
import type { MeData, CourierData, Mission } from "@/lib/types";
import type { DocEntry } from "@/lib/util";
import { euro, km, VEHICLES, hoursLabel, fmtDateTime, havKm } from "@/lib/util";
import { Badge, Field, Stepper, Toggle, StatusChip, PageHead, Spinner, EmptyState } from "@/components/ui";
import MapView from "@/components/MapView";
import { AreaChart } from "@/components/Charts";

/* ---------------- Candidature ---------------- */

function DocInput({ label, docs, setDocs }: { label: string; docs: DocEntry[]; setDocs: (d: DocEntry[]) => void }) {
  const existing = docs.find((d) => d.name === label);
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-bold transition ${existing ? "border-leaf/50 bg-leaf/8 text-leaf" : "border-dashed border-ink/25 hover:border-river/60"}`}>
      <span>{existing ? "✓" : "📎"} {label}</span>
      <span className="text-[11px] text-ink-soft truncate max-w-40">{existing ? existing.fileName : "Joindre un fichier"}</span>
      <input
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setDocs([...docs.filter((d) => d.name !== label), { name: label, fileName: f.name }]);
        }}
      />
    </label>
  );
}

function ApplyForm() {
  const [f, setF] = useState({
    pseudo: "", password: "", displayName: "", birthDate: "", email: "", phone: "", address: "",
    statut: "Micro-entrepreneur", siren: "", vehicle: "velo", immat: "", permis: "", insuranceExp: "", iban: "",
  });
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const motorized = f.vehicle === "scooter" || f.vehicle === "voiture";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("applyLivreur", { ...f, docs });
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
        <h3 className="font-display text-xl font-black">1 · Identité & compte</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Pseudonyme de connexion"><input className="input" value={f.pseudo} onChange={(e) => set("pseudo", e.target.value)} placeholder="ex. yanis_b" /></Field>
          <Field label="Mot de passe"><input className="input" type="password" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="6 caractères min." /></Field>
          <Field label="Nom et prénom"><input className="input" value={f.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder="Prénom Nom" /></Field>
          <Field label="Date de naissance"><input className="input" type="date" value={f.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></Field>
          <Field label="Adresse électronique"><input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="vous@exemple.fr" /></Field>
          <Field label="Téléphone"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="06 …" /></Field>
          <div className="sm:col-span-2"><Field label="Adresse postale"><input className="input" value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="N°, rue, 37600 Loches" /></Field></div>
        </div>
      </div>
      <div>
        <h3 className="font-display text-xl font-black">2 · Situation professionnelle</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Statut">
            <select className="input" value={f.statut} onChange={(e) => set("statut", e.target.value)}>
              <option>Micro-entrepreneur</option><option>Entreprise individuelle</option><option>Société (SASU / EURL…)</option><option>Portage salarial</option>
            </select>
          </Field>
          <Field label="N° SIREN / SIRET" hint="Requis selon votre statut — vérifié par l'administration."><input className="input" value={f.siren} onChange={(e) => set("siren", e.target.value)} placeholder="912 345 678" /></Field>
          <div className="sm:col-span-2"><Field label="IBAN (versement de vos revenus)"><input className="input" value={f.iban} onChange={(e) => set("iban", e.target.value)} placeholder="FR76 …" /></Field></div>
        </div>
      </div>
      <div>
        <h3 className="font-display text-xl font-black">3 · Transport</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Véhicule">
            <select className="input" value={f.vehicle} onChange={(e) => set("vehicle", e.target.value)}>
              {Object.entries(VEHICLES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
          </Field>
          <Field label="Assurance pro — échéance"><input className="input" type="date" value={f.insuranceExp} onChange={(e) => set("insuranceExp", e.target.value)} /></Field>
          {motorized && <Field label="Immatriculation"><input className="input" value={f.immat} onChange={(e) => set("immat", e.target.value)} placeholder="AB-123-CD" /></Field>}
          {motorized && <Field label="Permis / BSR"><input className="input" value={f.permis} onChange={(e) => set("permis", e.target.value)} placeholder="Catégorie AM / B…" /></Field>}
        </div>
        <p className="mt-4 label">Justificatifs (adaptés à votre statut et véhicule)</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <DocInput label="Pièce d'identité" docs={docs} setDocs={setDocs} />
          <DocInput label="Justificatif d'immatriculation (SIRENE/Kbis)" docs={docs} setDocs={setDocs} />
          <DocInput label="Attestation d'assurance usage professionnel" docs={docs} setDocs={setDocs} />
          {motorized && <DocInput label="Carte grise du véhicule" docs={docs} setDocs={setDocs} />}
          {motorized && <DocInput label="Permis de conduire" docs={docs} setDocs={setDocs} />}
          {f.vehicle === "velo" && <DocInput label="Attestation sur l'honneur vélo" docs={docs} setDocs={setDocs} />}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
          🔒 Documents chiffrés, accessibles uniquement à l'administration habilitée. Le transport rémunéré pour autrui peut
          relever du registre des transporteurs (qualification vérifiée avec la DREAL avant lancement). Vous conservez une
          autonomie totale : heures, capacité et zone sont vos choix.
        </p>
      </div>
      <button className="btn-river w-full !py-4 text-base" disabled={busy}>
        {busy ? <Spinner /> : "Transmettre mon dossier à l'administration →"}
      </button>
    </form>
  );
}

/* ---------------- Suivi de dossier ---------------- */

function PendingPanel({ me }: { me: MeData }) {
  const u = me.user!;
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const steps = ["Dossier transmis", "Vérification administrative", "Décision"];
  const idx = u.status === "pending" ? 1 : u.status === "docs_required" ? 1 : 2;
  const resubmit = async () => {
    setBusy(true);
    try {
      await api("resubmitDocs", { docs });
      toast("Documents complémentaires envoyés ✔");
      window.location.reload();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="card p-6">
        <PageHead
          kicker="Candidature livreur"
          title={u.status === "pending" ? "Dossier en cours de vérification" : u.status === "docs_required" ? "Documents complémentaires requis" : u.status === "refused" ? "Dossier refusé" : "Compte suspendu"}
          sub="Aucune livraison n'est possible avant validation administrative de votre dossier."
        />
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${i < idx ? "bg-leaf text-cream" : i === idx ? "bg-river text-cream dot-live" : "bg-paper border border-line text-ink-soft"}`}>{i < idx ? "✓" : i + 1}</span>
              <span className="text-[11px] font-extrabold leading-tight">{s}</span>
              {i < steps.length - 1 && <span className="h-0.5 flex-1 rounded bg-line" />}
            </div>
          ))}
        </div>
        {u.statusNote && (
          <div className="mt-5 rounded-xl border border-ambre/50 bg-ambre/10 px-4 py-3 text-sm font-bold text-[#8a5a00]">
            💬 Message de l'administration : {u.statusNote}
          </div>
        )}
        <div className="mt-5">
          <p className="label">Pièces déjà déposées</p>
          <div className="space-y-1.5">
            {((u.profile.docs as DocEntry[]) ?? []).map((d, i) => (
              <p key={i} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-xs font-bold"><span>📄</span> {d.name} <span className="text-ink-soft">· {d.fileName}</span></p>
            ))}
          </div>
        </div>
      </div>
      {u.status === "docs_required" && (
        <div className="card p-6">
          <p className="font-display text-lg font-black">Transmettre les pièces demandées</p>
          <div className="mt-3 space-y-2">
            <DocInput label="Document complémentaire 1" docs={docs} setDocs={setDocs} />
            <DocInput label="Document complémentaire 2" docs={docs} setDocs={setDocs} />
          </div>
          <button onClick={resubmit} disabled={busy || docs.length === 0} className="btn-river mt-4 w-full">{busy ? <Spinner /> : "Renvoyer mon dossier"}</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Mission ---------------- */

function MissionCard({ m, onAction, busy }: { m: Mission; onAction: (a: string, id: number) => void; busy: boolean }) {
  const vehicleTarget = m.status === "prete" ? { lat: m.merchantLat, lng: m.merchantLng } : { lat: m.lat, lng: m.lng };
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/60 px-4 py-3">
        <p className="font-extrabold">{m.code} {m.urgent && <Badge tone="vermillon">⚡ urgente</Badge>}</p>
        <div className="flex items-center gap-2">
          <Badge tone="leaf">+{euro(m.gain)}</Badge>
          <StatusChip status={m.status} />
        </div>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2 text-sm">
          <p className="font-bold">{m.merchantEmoji} <span className="text-ink-soft">Récupérer :</span> {m.merchantName} · {m.merchantAddress}</p>
          <p className="font-bold">🏠 <span className="text-ink-soft">Livrer :</span> {m.recipient} · {m.address}</p>
          {m.addressExtra && <p className="rounded-lg bg-paper px-3 py-1.5 text-xs font-bold text-ink-soft">🔑 {m.addressExtra}</p>}
          <p className="text-xs font-bold text-ink-soft">{m.itemCount} article(s) · {km(m.distanceKm)} · <a className="underline" href={`tel:${m.phone.replace(/\s/g, "")}`}>📞 {m.phone}</a></p>
        </div>
        <div className="flex flex-row gap-2 sm:flex-col">
          {m.status === "prete" && (
            <button disabled={busy} onClick={() => onAction("courierPicked", m.id)} className="btn-river flex-1 !text-xs">📦 Commande récupérée</button>
          )}
          {(m.status === "recuperee" || m.status === "en_livraison") && (
            <button disabled={busy} onClick={() => onAction("courierDelivered", m.id)} className="btn-leaf flex-1 !text-xs">✅ Commande livrée</button>
          )}
          <a
            className="btn-ghost flex-1 !text-xs"
            target="_blank"
            rel="noreferrer"
            href={`https://www.openstreetmap.org/directions?route=%3B${vehicleTarget.lat}%2C${vehicleTarget.lng}`}
          >
            🧭 Itinéraire
          </a>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Tableau de bord ---------------- */

function Dashboard() {
  const { data, refresh } = usePoll<CourierData>("courier", {}, 4000);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(5);
  const [capacity, setCapacity] = useState(5);
  const [geo, setGeo] = useState<"off" | "pending" | "gps" | "sim">("off");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"today" | "week" | "month" | "total">("today");
  const zoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posRef = useRef<[number, number] | null>(null);
  const initialized = useRef(false);

  const c = data?.courier;
  const online = c?.online ?? false;
  const missions = data?.missions ?? [];

  useEffect(() => {
    if (c && !initialized.current) {
      initialized.current = true;
      setCenter([c.centerLat, c.centerLng]);
      setRadius(c.radiusKm);
      setCapacity(c.capacity);
      posRef.current = [c.lat, c.lng];
    }
  }, [c]);

  const pushZone = (patch: Record<string, unknown>) => {
    if (zoneTimer.current) clearTimeout(zoneTimer.current);
    zoneTimer.current = setTimeout(async () => {
      try {
        await api("courierZone", patch);
        refresh();
      } catch (e) {
        toast((e as Error).message, "err");
      }
    }, 350);
  };

  /* Géolocalisation : GPS réel si autorisé, simulation sinon */
  useEffect(() => {
    const active = online || missions.length > 0;
    if (!active || !data) {
      setGeo("off");
      return;
    }
    setGeo("pending");
    let watchId: number | null = null;
    let sim: ReturnType<typeof setInterval> | null = null;
    let lastSend = 0;
    let got = false;
    const send = (lat: number, lng: number) => {
      posRef.current = [lat, lng];
      if (Date.now() - lastSend > 4500) {
        lastSend = Date.now();
        api("courierPosition", { lat, lng }).catch(() => undefined);
      }
    };
    const startSim = () => {
      if (sim) return;
      setGeo("sim");
      sim = setInterval(() => {
        const pos = posRef.current ?? [data.courier.centerLat, data.courier.centerLng];
        const mission = missions[0];
        let target: [number, number];
        if (mission) {
          target = mission.status === "prete" ? [mission.merchantLat, mission.merchantLng] : [mission.lat, mission.lng];
        } else {
          target = [data.courier.centerLat + 0.002 * Math.sin(Date.now() / 40000), data.courier.centerLng + 0.003 * Math.cos(Date.now() / 40000)];
        }
        send(pos[0] + (target[0] - pos[0]) * 0.22, pos[1] + (target[1] - pos[1]) * 0.22);
      }, 3000);
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (p) => {
          /* En démo, si l'appareil est loin de Loches, on projette sur le secteur */
          const near = havKm(p.coords.latitude, p.coords.longitude, 47.1289, 0.9973) < 30;
          if (near) {
            got = true;
            setGeo("gps");
            send(p.coords.latitude, p.coords.longitude);
          } else startSim();
        },
        () => startSim(),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
      );
      setTimeout(() => {
        if (!got) startSim();
      }, 9000);
    } else {
      startSim();
    }
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (sim) clearInterval(sim);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, missions.length, !!data]);

  const goOnline = async () => {
    setBusy(true);
    try {
      await api("courierOnline", { capacity, radiusKm: radius, centerLat: center?.[0], centerLng: center?.[1] });
      toast("Vous êtes en ligne — bonnes courses ! 🛵");
      refresh();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };
  const goOffline = async () => {
    setBusy(true);
    try {
      await api("courierOffline");
      toast("Déconnecté. Vos missions en cours restent actives.", "info");
      refresh();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };
  const onAction = async (action: string, id: number) => {
    setBusy(true);
    try {
      await api(action, { orderId: id });
      toast(action === "courierPicked" ? "Commande récupérée — en route !" : "Course terminée, gains crédités 💶");
      refresh();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };
  const requestPayout = async () => {
    setBusy(true);
    try {
      await api("requestPayout", {});
      toast("Demande de versement envoyée à l'administration.");
      refresh();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  if (!data || !c || !center) {
    return <div className="space-y-4"><div className="skeleton h-40" /><div className="skeleton h-72" /></div>;
  }

  const sector = data.sector;
  const myRemaining = Math.max(0, c.capacity - missions.length);
  const earn = data.earnings;
  const tabVal = tab === "today" ? earn.today : tab === "week" ? earn.week : tab === "month" ? earn.month : earn.total;

  return (
    <div className="space-y-6">
      {/* Bandeau statut */}
      <div className={`relative overflow-hidden rounded-3xl p-6 text-cream grain ${online ? "bg-gradient-to-r from-river to-[#12327e]" : "bg-night"}`}>
        <div className="relative flex flex-wrap items-center gap-5">
          <span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${online ? "bg-cream/15" : "bg-cream/8"}`}>{VEHICLES[c.vehicle]?.emoji}</span>
          <div className="flex-1">
            <p className="font-display text-2xl font-black">
              {online ? "Vous êtes en ligne" : "Vous êtes hors ligne"}
            </p>
            <p className="text-sm text-cream/75">
              {online
                ? `${myRemaining} place(s) restante(s) sur ${c.capacity} · rayon ${km(c.radiusKm)} · service ${hoursLabel(data.config.openHour, data.config.closeHour)}`
                : `Connectez-vous librement entre ${data.config.openHour}h et ${data.config.closeHour}h. Choisissez capacité et zone ci-dessous.`}
              {geo === "gps" && " · 📍 GPS actif"}
              {geo === "sim" && " · 📍 position simulée (GPS non autorisé)"}
              {geo === "pending" && " · localisation…"}
            </p>
          </div>
          {online ? (
            <button onClick={goOffline} disabled={busy} className="btn bg-cream text-ink hover:bg-paper">⏻ Se déconnecter</button>
          ) : (
            <button onClick={goOnline} disabled={busy || !data.config.serviceOpen} className="btn bg-leaf text-cream hover:brightness-110">
              {busy ? <Spinner /> : data.config.serviceOpen ? "▶ Je me connecte" : `Service fermé (${data.config.openHour}h–${data.config.closeHour}h)`}
            </button>
          )}
        </div>
        {online && missions.length > 0 && (
          <p className="relative mt-3 text-[11px] font-bold text-cream/60">La déconnexion n'annule jamais vos courses acceptées : vous gardez le suivi jusqu'à la livraison.</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Zone & capacité */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg font-black">🗺️ Ma zone d'intervention</p>
              <p className="text-xs text-ink-soft">Déplacez le point central sur la carte, ajustez le rayon — appliqué en direct.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="label !mb-0">Capacité</span>
              <Stepper value={capacity} min={1} max={data.config.maxCapacity} onChange={(v) => { setCapacity(v); pushZone({ capacity: v }); }} />
              <span className="text-xs font-bold text-ink-soft">courses</span>
            </div>
          </div>
          <MapView
            className="mt-4 h-72"
            center={center}
            zoom={13}
            markers={[
              { id: "center", lat: center[0], lng: center[1], kind: "center", label: "Point central — déplacez-moi" },
              ...(posRef.current ? [{ id: "me", lat: posRef.current[0], lng: posRef.current[1], kind: "courier" as const, emoji: VEHICLES[c.vehicle]?.emoji ?? "🛵", label: "Ma position" }] : []),
              ...missions.map((m) => ({ id: `m${m.id}`, lat: m.status === "prete" ? m.merchantLat : m.lat, lng: m.status === "prete" ? m.merchantLng : m.lng, kind: m.status === "prete" ? ("shop" as const) : ("home" as const), emoji: m.status === "prete" ? m.merchantEmoji : "🏠", label: m.code })),
            ]}
            circle={{ lat: center[0], lng: center[1], km: radius }}
            draggableId="center"
            onPick={(lat, lng) => { setCenter([lat, lng]); pushZone({ centerLat: lat, centerLng: lng }); }}
          />
          <div className="mt-4 flex items-center gap-4">
            <span className="label !mb-0 whitespace-nowrap">Rayon : {km(radius)}</span>
            <input
              type="range"
              min={1}
              max={data.config.maxRadiusKm}
              step={0.5}
              value={radius}
              onChange={(e) => { const v = Number(e.target.value); setRadius(v); pushZone({ radiusKm: v }); }}
              className="w-full accent-[#2667FF]"
              aria-label="Rayon d'intervention"
            />
            <span className="text-xs font-bold text-ink-soft whitespace-nowrap">max {data.config.maxRadiusKm} km</span>
          </div>
        </div>

        {/* Secteur */}
        <div className="card p-5">
          <p className="font-display text-lg font-black">📊 Places du secteur</p>
          <p className="mt-1 text-[11px] text-ink-soft">Capacités restantes des livreurs connectés dans votre zone, moins les commandes en attente d'attribution.</p>
          <div className="mt-4 flex items-end gap-2">
            <span className="font-display text-5xl font-black text-river tabular-nums">{sector.places}</span>
            <span className="pb-1.5 text-sm font-bold text-ink-soft">place(s) ouverte(s)</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-paper">
            <div className="h-full rounded-full bg-gradient-to-r from-river to-leaf transition-all" style={{ width: `${sector.totalRemaining ? (sector.places / sector.totalRemaining) * 100 : 0}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-extrabold">
            <div className="rounded-xl bg-paper px-2 py-2"><span className="block text-lg tabular-nums">{sector.couriers}</span>connectés</div>
            <div className="rounded-xl bg-paper px-2 py-2"><span className="block text-lg tabular-nums">{sector.totalRemaining}</span>capacité</div>
            <div className="rounded-xl bg-paper px-2 py-2"><span className="block text-lg tabular-nums">{sector.pending}</span>en attente</div>
          </div>
          <div className="mt-4 space-y-2">
            {sector.list.map((l) => (
              <div key={l.id} className="flex items-center gap-2 text-xs font-bold">
                <span className="h-2 w-2 rounded-full bg-leaf dot-live" />
                <span className="flex-1 truncate">{l.name} {l.isBot && <span className="text-ink-soft/60">·</span>}</span>
                <span>{VEHICLES[l.vehicle]?.emoji}</span>
                <Badge tone={l.remaining > 0 ? "river" : "soft"}>{l.remaining}/{l.capacity}</Badge>
              </div>
            ))}
            {sector.list.length === 0 && <p className="text-xs text-ink-soft">Personne d'autre en ligne sur ce secteur.</p>}
          </div>
          <p className="mt-4 rounded-xl bg-river/8 px-3 py-2.5 text-[11px] font-bold leading-relaxed text-river">
            Vous ne recevrez jamais plus de {c.capacity} commande(s) simultanée(s) : la limite est appliquée automatiquement à l'attribution.
          </p>
        </div>
      </div>

      {/* Missions */}
      <div>
        <h2 className="font-display text-xl font-black">🚚 Missions en cours {missions.length > 0 && <Badge tone="river">{missions.length}/{c.capacity}</Badge>}</h2>
        <div className="mt-3 space-y-4">
          {missions.length === 0 ? (
            <EmptyState emoji="🕊️" title="Aucune mission pour l'instant" text={online ? "Vous êtes visible par le système d'attribution. Les commandes prêtes de votre zone vous seront proposées automatiquement." : "Connectez-vous pour recevoir des commandes. Les commerces Chez Marcel se gèrent en direct depuis l'espace commerçant."} />
          ) : (
            missions.map((m) => <MissionCard key={m.id} m={m} onAction={onAction} busy={busy} />)
          )}
        </div>
      </div>

      {/* Revenus */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-lg font-black">💶 Mes revenus</p>
            <div className="flex gap-1.5">
              {([["today", "Jour"], ["week", "Semaine"], ["month", "Mois"], ["total", "Cumul"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`chip !py-1.5 !text-[11px] ${tab === k ? "chip-active" : ""}`}>{l}</button>
              ))}
            </div>
          </div>
          <p className="mt-3 font-display text-4xl font-black tabular-nums text-vermillon-deep">{euro(tabVal)}</p>
          <p className="text-[11px] font-bold text-ink-soft">{data.config.courierSharePercent} % des frais de livraison · chaque course terminée génère une écriture financière</p>
          <div className="mt-4">
            <AreaChart values={earn.series.map((s) => s.amount / 100)} labels={earn.series.map((s) => s.day)} color="#2667FF" format={(v) => euro(Math.round(v * 100))} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-paper p-3 text-center"><p className="text-lg font-black tabular-nums">{earn.deliveredCount}</p><p className="text-[10px] font-extrabold uppercase text-ink-soft">Livrées</p></div>
            <div className="rounded-xl bg-paper p-3 text-center"><p className="text-lg font-black tabular-nums">{earn.cancelledCount}</p><p className="text-[10px] font-extrabold uppercase text-ink-soft">Annulées</p></div>
            <div className="rounded-xl bg-paper p-3 text-center"><p className="text-lg font-black tabular-nums">{euro(earn.fees)}</p><p className="text-[10px] font-extrabold uppercase text-ink-soft">Part plateforme</p></div>
            <div className="rounded-xl bg-paper p-3 text-center"><p className="text-lg font-black tabular-nums">{euro(earn.paidOut)}</p><p className="text-[10px] font-extrabold uppercase text-ink-soft">Déjà versé</p></div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card bg-night !border-night p-5 text-cream grain relative overflow-hidden">
            <p className="relative text-[11px] font-extrabold uppercase tracking-wider text-cream/60">Disponible au versement</p>
            <p className="relative mt-1 font-display text-4xl font-black text-ambre tabular-nums">{euro(earn.available)}</p>
            {earn.pendingPayout > 0 && <p className="relative mt-1 text-xs font-bold text-cream/70">⏳ {euro(earn.pendingPayout)} en cours de traitement</p>}
            <button onClick={requestPayout} disabled={busy || earn.available < data.config.minPayout} className="btn relative mt-4 w-full bg-ambre text-night hover:brightness-105">
              Demander un versement
            </button>
            <p className="relative mt-2 text-center text-[10px] font-bold text-cream/50">Minimum {euro(data.config.minPayout)} · via PSP agréé (démo)</p>
          </div>
          <div className="card p-5">
            <p className="font-display text-base font-black">Versements précédents</p>
            <div className="mt-3 space-y-2">
              {data.payouts.length === 0 && <p className="text-xs text-ink-soft">Aucun versement pour l'instant.</p>}
              {data.payouts.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs font-bold">
                  <span className="text-ink-soft">{fmtDateTime(p.createdAt)}</span>
                  <span className="tabular-nums">{euro(p.amount)}</span>
                  <Badge tone={p.status === "verse" ? "leaf" : p.status === "refuse" ? "danger" : "ambre"}>{p.status === "verse" ? "Versé" : p.status === "refuse" ? "Refusé" : "Demandé"}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Historique */}
      <div className="card p-5">
        <p className="font-display text-lg font-black">Historique récent</p>
        <div className="mt-3 divide-y divide-line/70">
          {data.history.length === 0 && <p className="py-3 text-sm text-ink-soft">Vos courses terminées apparaîtront ici.</p>}
          {data.history.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
              <span className="font-extrabold">{h.code}</span>
              <span className="flex-1 truncate text-ink-soft">{h.merchantEmoji} {h.merchantName} → {h.address}</span>
              <span className="text-xs font-bold text-ink-soft">{fmtDateTime(h.createdAt)}</span>
              <Badge tone={h.status === "livree" ? "leaf" : "danger"}>{h.status === "livree" ? `+${euro(h.gain)}` : "Annulée"}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */

export default function LivreurPage() {
  const me = usePoll<MeData>("me", {}, 8000);
  const [showApply, setShowApply] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (window.location.search.includes("apply")) setShowApply(true);
  }, []);

  const u = me.data?.user;

  const demoLogin = async () => {
    setSwitching(true);
    try {
      await api("login", { pseudo: "yanis", password: "demo1234" });
      toast("Connecté en tant que Yanis (livreur validé) 🛵");
      me.refresh();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {!me.data ? (
        <div className="space-y-4"><div className="skeleton h-48" /><div className="skeleton h-80" /></div>
      ) : !u || (u.role !== "livreur" && !showApply) ? (
        <>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-river via-[#1c4fd6] to-[#12327e] p-8 text-cream grain sm:p-12">
            <span className="absolute -right-6 -bottom-10 text-[160px] opacity-15">🛵</span>
            <p className="relative text-[11px] font-extrabold uppercase tracking-[0.22em] text-cream/60">Espace livreur · Loches (37)</p>
            <h1 className="relative mt-3 max-w-2xl font-display text-4xl font-black leading-tight sm:text-5xl">Votre secteur. Vos heures. Vos courses.</h1>
            <p className="relative mt-4 max-w-xl text-[15px] leading-relaxed text-cream/80">
              Choisissez votre capacité (ex. 5 commandes), votre point central (ex. mairie de Loches) et votre rayon
              (ex. 5 km). Le système calcule les places disponibles et ne vous attribue jamais plus que votre limite.
            </p>
            <div className="relative mt-6 flex flex-wrap gap-3">
              {u && u.role !== "livreur" ? (
                <>
                  <button onClick={demoLogin} disabled={switching} className="btn bg-cream text-river hover:bg-paper">{switching ? <Spinner /> : "🛵 Essayer avec le compte démo Yanis"}</button>
                  <button onClick={() => setShowApply(true)} className="btn border border-cream/40 text-cream hover:bg-cream/10">Déposer ma candidature</button>
                </>
              ) : (
                <>
                  <button onClick={() => setShowApply(true)} className="btn bg-cream text-river hover:bg-paper">Déposer ma candidature →</button>
                  <button onClick={demoLogin} disabled={switching} className="btn border border-cream/40 text-cream hover:bg-cream/10">{switching ? <Spinner /> : "Compte démo : yanis / demo1234"}</button>
                </>
              )}
            </div>
            <div className="relative mt-8 grid max-w-2xl gap-3 text-[12px] font-extrabold sm:grid-cols-3">
              <span className="rounded-xl bg-cream/10 px-4 py-3">💶 70 % des frais de livraison pour vous</span>
              <span className="rounded-xl bg-cream/10 px-4 py-3">📊 Revenus jour / semaine / mois + versements</span>
              <span className="rounded-xl bg-cream/10 px-4 py-3">🕓 Connexion libre 04h–23h, déconnexion à tout moment</span>
            </div>
          </div>
          {u && u.role !== "livreur" && (
            <p className="mt-4 rounded-xl border border-line bg-cream px-4 py-3 text-sm font-bold text-ink-soft">
              Vous êtes connecté·e en tant que <Badge tone="vermillon">{u.role}</Badge>. L'espace livreur nécessite un compte livreur validé par l'administration.
            </p>
          )}
        </>
      ) : u.role === "livreur" && u.status !== "active" ? (
        <PendingPanel me={me.data} />
      ) : u.role === "livreur" ? (
        <>
          <PageHead kicker="Espace livreur" title={`Bonjour ${u.displayName.split(" ")[0]} 👋`} sub="Disponibilité, zone, missions et revenus — tout se pilote ici, en direct." />
          <Dashboard />
        </>
      ) : null}

      {showApply && (!u || u.role !== "livreur") && (
        <div className="mt-8">
          <PageHead kicker="Candidature" title="Devenir livreur Locho" sub="Votre dossier est transmis automatiquement à l'administration. Aucune livraison n'est possible avant validation." />
          <ApplyForm />
          <p className="mt-3 text-center text-sm font-bold text-ink-soft">Déjà candidat ? <Link href="/connexion" className="underline text-river">Se connecter</Link></p>
        </div>
      )}
    </div>
  );
}
