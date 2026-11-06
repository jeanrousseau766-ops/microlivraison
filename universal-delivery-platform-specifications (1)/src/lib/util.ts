/* Utilitaires partagés client / serveur */
import type {
  OrderItem,
  OrderStatus,
  FeeBreakdown,
  TimelineEvent,
  DocEntry,
  Role,
  UserStatus,
} from "@/db/schema";

export type { OrderItem, OrderStatus, FeeBreakdown, TimelineEvent, DocEntry, Role, UserStatus };

export const LOCHES = { lat: 47.1289, lng: 0.9973 };

export interface Config {
  openHour: number;
  closeHour: number;
  minFee: number;
  baseFee: number;
  perKm: number;
  urgentSupplement: number;
  nightSupplement: number;
  nightBefore: number;
  nightAfter: number;
  categorySupplements: Record<string, number>;
  promoPercent: number;
  courierSharePercent: number;
  maxCapacity: number;
  maxRadiusKm: number;
  minPayout: number;
  zones: string[];
  categories: string[];
  forbidden: string[];
}

export const CATEGORY_META: Record<string, { emoji: string; cover: string }> = {
  Restauration: { emoji: "🍽️", cover: "vermillon" },
  Boulangerie: { emoji: "🥖", cover: "ambre" },
  Courses: { emoji: "🛒", cover: "leaf" },
  "Fleurs & cadeaux": { emoji: "💐", cover: "rose" },
  Mode: { emoji: "🧣", cover: "grape" },
  "Maison & fournitures": { emoji: "🎁", cover: "river" },
  "Colis & documents": { emoji: "✉️", cover: "night" },
};

export const VEHICLES: Record<string, { label: string; emoji: string; speed: number }> = {
  velo: { label: "Vélo", emoji: "🚲", speed: 15 },
  vae: { label: "Vélo électrique", emoji: "⚡", speed: 20 },
  scooter: { label: "Scooter", emoji: "🛵", speed: 24 },
  voiture: { label: "Voiture", emoji: "🚗", speed: 26 },
};

export const STATUS_FLOW: { key: OrderStatus; label: string; short: string }[] = [
  { key: "creee", label: "Commande effectuée", short: "Effectuée" },
  { key: "payee", label: "Paiement confirmé", short: "Payée" },
  { key: "acceptee", label: "Acceptée par le commerçant", short: "Acceptée" },
  { key: "preparation", label: "Préparation en cours", short: "Préparation" },
  { key: "recuperee", label: "Récupérée par le livreur", short: "Récupérée" },
  { key: "en_livraison", label: "Livraison en cours", short: "En route" },
  { key: "livree", label: "Commande livrée", short: "Livrée" },
];

export function statusLabel(s: OrderStatus): string {
  if (s === "prete") return "Prête — en attente du livreur";
  if (s === "annulee") return "Commande annulée";
  if (s === "refusee") return "Refusée par le commerçant";
  return STATUS_FLOW.find((f) => f.key === s)?.label ?? s;
}

export function statusIndex(s: OrderStatus): number {
  if (s === "prete") return 3.5;
  const i = STATUS_FLOW.findIndex((f) => f.key === s);
  return i < 0 ? 0 : i;
}

export const ACTIVE_STATUSES: OrderStatus[] = [
  "creee",
  "payee",
  "acceptee",
  "preparation",
  "prete",
  "recuperee",
  "en_livraison",
];

export function euro(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function km(v: number): string {
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " km";
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export function fmtDay(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  });
}

export function fmtDateTime(ts: number): string {
  return `${fmtDay(ts)} · ${fmtTime(ts)}`;
}

export function timeAgo(ts: number): string {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `il y a ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

export function havKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function roadKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  return Math.max(0.4, havKm(aLat, aLng, bLat, bLng) * 1.35);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function parisNow(now = Date.now()): { hour: number; day: number } {
  const d = new Date(new Date(now).toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return { hour: d.getHours(), day: d.getDay() };
}

export function serviceOpen(cfg: Pick<Config, "openHour" | "closeHour">, now = Date.now()): boolean {
  const { hour } = parisNow(now);
  return hour >= cfg.openHour && hour < cfg.closeHour;
}

export function merchantOpen(
  m: { openHour: number; closeHour: number; days: string },
  now = Date.now()
): boolean {
  const { hour, day } = parisNow(now);
  return m.days.includes(String(day)) && hour >= m.openHour && hour < m.closeHour;
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function hoursLabel(open: number, close: number): string {
  return `${pad2(open)}h – ${pad2(close)}h`;
}

/* Calcul des frais de livraison — pur, partagé client (estimation) / serveur (facturation) */
export function computeFee(
  cfg: Config,
  distanceKm: number,
  category: string,
  urgent: boolean,
  hour?: number
): FeeBreakdown {
  const h = hour ?? parisNow().hour;
  const lines: FeeLine[] = [];
  const base = Math.round(cfg.baseFee);
  const distance = Math.round(cfg.perKm * distanceKm);
  lines.push({ label: "Prise en charge", amount: base });
  lines.push({
    label: `Distance (${distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km)`,
    amount: distance,
  });
  let total = base + distance;
  if (total < cfg.minFee) {
    lines.push({ label: "Minimum de livraison", amount: cfg.minFee - total });
    total = cfg.minFee;
  }
  const urgentAmt = urgent ? cfg.urgentSupplement : 0;
  if (urgentAmt) lines.push({ label: "Supplément urgence", amount: urgentAmt });
  const horaireAmt = h < cfg.nightBefore || h >= cfg.nightAfter ? cfg.nightSupplement : 0;
  if (horaireAmt) lines.push({ label: "Supplément horaire étendu", amount: horaireAmt });
  const catAmt = cfg.categorySupplements[category] ?? 0;
  if (catAmt) lines.push({ label: `Supplément ${category.toLowerCase()}`, amount: catAmt });
  total += urgentAmt + horaireAmt + catAmt;
  const promo = cfg.promoPercent > 0 ? -Math.round((total * cfg.promoPercent) / 100) : 0;
  if (promo) lines.push({ label: `Promotion (−${cfg.promoPercent} %)`, amount: promo });
  total += promo;
  const courierShare = Math.round((total * cfg.courierSharePercent) / 100);
  return {
    base,
    distance,
    urgent: urgentAmt,
    horaire: horaireAmt,
    categorie: catAmt,
    promo,
    lines,
    courierShare,
    platformShare: total - courierShare,
  };
}

export function feeTotal(fb: FeeBreakdown): number {
  return fb.lines.reduce((s, l) => s + l.amount, 0);
}

import type { FeeLine } from "@/db/schema";

export const DISPUTE_REASONS = [
  "Commande non reçue",
  "Produit endommagé",
  "Produit manquant",
  "Retard important",
  "Commerçant indisponible",
  "Livreur indisponible",
  "Mauvaise adresse",
  "Problème de paiement",
];

export const ADDRESS_PRESETS = [
  { label: "Place de la Marne, Loches", lat: 47.1287, lng: 0.9963 },
  { label: "Rue Picoys, Loches", lat: 47.1296, lng: 0.9944 },
  { label: "Quartier Saint-Antoine, Loches", lat: 47.1329, lng: 0.9997 },
  { label: "Beaulieu-lès-Loches (centre)", lat: 47.1268, lng: 1.0104 },
  { label: "Perrusson (bourg)", lat: 47.1128, lng: 1.0186 },
];
