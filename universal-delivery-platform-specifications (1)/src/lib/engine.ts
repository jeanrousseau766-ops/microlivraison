import { eq, inArray, and } from "drizzle-orm";
import { db } from "@/db";
import { orders, merchants, couriers, users, transactions } from "@/db/schema";
import type { OrderStatus, TimelineEvent } from "@/db/schema";
import { getConfig, notify, activeCounts } from "@/lib/core";
import { ACTIVE_STATUSES, VEHICLES, clamp, havKm, lerp, roadKm, euro } from "@/lib/util";

type Order = typeof orders.$inferSelect;
type Merchant = typeof merchants.$inferSelect;
type Courier = typeof couriers.$inferSelect;
type User = typeof users.$inferSelect;

const TIME_SCALE = 5; // simulation : temps compressé ×5 pour la démonstration

export function travelMs(distanceKm: number, vehicle: string): number {
  const speed = (VEHICLES[vehicle]?.speed ?? 18) * TIME_SCALE;
  return Math.round(clamp((distanceKm / speed) * 3600000, 15000, 240000));
}

/**
 * Change l'état d'une commande. Si `from` est fourni, la mise à jour n'a lieu
 * que si l'état actuel en base correspond (transition atomique) : renvoie
 * `false` si une autre instance a déjà traité cette transition — les
 * écritures financières et notifications n'ont alors pas lieu en double.
 */
export async function pushStatus(
  o: Order,
  status: OrderStatus,
  label: string,
  extra: Partial<typeof orders.$inferInsert> = {},
  from?: OrderStatus[]
): Promise<boolean> {
  const now = Date.now();
  const timeline: TimelineEvent[] = [...(o.timeline ?? []), { status, at: now, label }];
  const cond =
    from && from.length
      ? and(eq(orders.id, o.id), inArray(orders.status, from))
      : eq(orders.id, o.id);
  const rows = await db
    .update(orders)
    .set({ status, statusAt: now, timeline, ...extra })
    .where(cond)
    .returning({ id: orders.id });
  if (rows.length === 0) return false;
  o.status = status;
  o.statusAt = now;
  o.timeline = timeline;
  return true;
}

/* ---------- Attribution ---------- */

export async function tryAssign(
  o: Order,
  shop: Merchant,
  cs: Courier[],
  us: Map<number, User>,
  counts: Map<number, number>
): Promise<boolean> {
  const candidates = cs
    .filter((c) => {
      const u = us.get(c.userId);
      if (!c.online || !u || u.status !== "active") return false;
      if ((counts.get(c.id) ?? 0) >= c.capacity) return false;
      return havKm(c.centerLat, c.centerLng, shop.lat, shop.lng) <= c.radiusKm + 0.8;
    })
    .sort((a, b) => {
      if (a.isBot !== b.isBot) return a.isBot ? 1 : -1; // priorité aux livreurs humains
      const ra = a.capacity - (counts.get(a.id) ?? 0);
      const rb = b.capacity - (counts.get(b.id) ?? 0);
      if (ra !== rb) return rb - ra;
      return (
        havKm(a.lat, a.lng, shop.lat, shop.lng) - havKm(b.lat, b.lng, shop.lat, shop.lng)
      );
    });
  const c = candidates[0];
  if (!c) return false;
  const now = Date.now();
  const etaPickup = now + travelMs(roadKm(c.lat, c.lng, shop.lat, shop.lng), c.vehicle);
  await db
    .update(orders)
    .set({ courierId: c.id, assignedAt: now, etaPickup, routeFrom: { lat: c.lat, lng: c.lng } })
    .where(eq(orders.id, o.id));
  o.courierId = c.id;
  o.assignedAt = now;
  counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
  const u = us.get(c.userId);
  const vehicle = VEHICLES[c.vehicle]?.label ?? c.vehicle;
  await notify(
    o.clientId,
    "livreur",
    `Livreur attribué : ${u?.displayName ?? "Votre livreur"}`,
    `${vehicle} · en route vers ${shop.name}. Sa position est visible sur votre carte.`,
    o.id
  );
  if (u && !c.isBot) {
    await notify(u.id, "mission", `Nouvelle mission chez ${shop.name}`, `Commande ${o.code} · ${o.address}`, o.id);
  }
  return true;
}

/* ---------- Étapes ---------- */

export async function pickupOrder(o: Order, shop: Merchant, vehicle: string): Promise<void> {
  const now = Date.now();
  const etaDrop = now + travelMs(roadKm(shop.lat, shop.lng, o.lat, o.lng), vehicle);
  const ok = await pushStatus(o, "recuperee", "Commande récupérée par le livreur", { pickedAt: now, etaDrop }, ["prete"]);
  if (!ok) return;
  o.pickedAt = now;
  o.etaDrop = etaDrop;
  await notify(o.clientId, "livreur", "Commande récupérée 📦", `Votre livreur a récupéré la commande ${o.code} chez ${shop.name}.`, o.id);
}

export async function deliverOrder(o: Order, c?: Courier): Promise<void> {
  const now = Date.now();
  /* Transition atomique : si une autre instance a déjà livré la commande,
     on n'écrit AUCUNE écriture comptable en double. */
  const ok = await pushStatus(o, "livree", "Commande livrée", { deliveredAt: now }, ["recuperee", "en_livraison"]);
  if (!ok) return;
  o.deliveredAt = now;
  const fb = o.feeBreakdown;
  const courierShare = fb?.courierShare ?? Math.round(o.deliveryFee * 0.7);
  const platformShare = o.deliveryFee - courierShare;
  await db.insert(transactions).values([
    { orderId: o.id, kind: "produits_commercant", amount: o.itemsTotal, partyRole: "commercant", partyId: o.merchantId, label: `Produits ${o.code} — prix commerçant`, createdAt: now },
    { orderId: o.id, kind: "part_livreur", amount: courierShare, partyRole: "livreur", partyId: o.courierId, label: `Part livreur ${o.code}`, createdAt: now },
    { orderId: o.id, kind: "part_plateforme", amount: platformShare, partyRole: "plateforme", partyId: null, label: `Part plateforme ${o.code}`, createdAt: now },
  ]);
  await notify(o.clientId, "ok", "Commande livrée 🎉", `La commande ${o.code} a été livrée. Merci et à très vite !`, o.id);
  if (c) {
    const u = await db.select().from(users).where(eq(users.id, c.userId)).limit(1);
    if (u[0] && !c.isBot) {
      await notify(u[0].id, "gain", `Course terminée · +${euro(courierShare)}`, `Commande ${o.code} livrée. Montant crédité sur votre solde.`, o.id);
    }
  }
}

export async function refundOrder(o: Order, status: OrderStatus, reason: string): Promise<void> {
  const now = Date.now();
  /* Garde atomique : un seul remboursement est enregistré par commande. */
  const ok = await pushStatus(
    o,
    status,
    status === "refusee" ? "Commande refusée par le commerçant" : "Commande annulée",
    { cancelReason: reason },
    ["creee", "payee", "acceptee", "preparation", "prete", "recuperee", "en_livraison"]
  );
  if (!ok) return;
  await db.insert(transactions).values({
    orderId: o.id,
    kind: "remboursement",
    amount: o.total,
    partyRole: "client",
    partyId: o.clientId,
    label: `Remboursement intégral ${o.code} (PSP démo)`,
    createdAt: now,
  });
  await notify(o.clientId, "alerte", status === "refusee" ? "Commande refusée" : "Commande annulée", `${reason} — remboursement intégral de ${euro(o.total)} en cours (2 à 5 jours ouvrés).`, o.id);
}

/* ---------- Boucle de simulation ---------- */

let lastTick = 0;
let ticking = false;

export async function maybeTick(force = false): Promise<void> {
  const now = Date.now();
  if (ticking) return;
  if (!force && now - lastTick < 2000) return;
  ticking = true;
  lastTick = now;
  try {
    await tick(now);
  } catch (e) {
    console.error("[engine]", e);
  } finally {
    ticking = false;
  }
}

async function tick(now: number): Promise<void> {
  const cfg = await getConfig();
  void cfg;
  const active = await db.select().from(orders).where(inArray(orders.status, ACTIVE_STATUSES));
  const ms = await db.select().from(merchants);
  const mMap = new Map(ms.map((m) => [m.id, m]));
  const cs = await db.select().from(couriers);
  const cMap = new Map(cs.map((c) => [c.id, c]));
  const us = await db.select().from(users);
  const uMap = new Map(us.map((u) => [u.id, u]));
  const counts = await activeCounts();

  for (const o of active) {
    const shop = mMap.get(o.merchantId);
    if (!shop) continue;
    const age = now - o.statusAt;
    const auto = shop.autoManage;

    if (o.status === "payee" && auto && age > 6000) {
      const prep = 6 + (o.id % 7);
      await pushStatus(o, "acceptee", "Commande acceptée par le commerçant", { prepMinutes: prep });
      await notify(o.clientId, "ok", `${shop.name} a accepté votre commande`, `Temps de préparation estimé : ${prep} min.`, o.id);
    } else if (o.status === "acceptee" && auto && age > 3000) {
      await pushStatus(o, "preparation", "Préparation en cours");
      await notify(o.clientId, "info", "Préparation en cours 👨‍🍳", `${shop.name} prépare votre commande ${o.code}.`, o.id);
    } else if (o.status === "preparation" && auto && age > clamp(o.prepMinutes * 7000, 30000, 85000)) {
      await pushStatus(o, "prete", "Commande prête");
      await notify(o.clientId, "info", "Commande prête ✔", `Recherche d'un livreur disponible dans votre secteur…`, o.id);
      await tryAssign(o, shop, cs, uMap, counts);
    } else if (o.status === "prete" && !o.courierId) {
      await tryAssign(o, shop, cs, uMap, counts);
    }

    /* Suivi du livreur attribué */
    if (o.courierId && (o.status === "prete" || o.status === "recuperee" || o.status === "en_livraison")) {
      const c = cMap.get(o.courierId);
      if (!c) continue;

      /* Réattribution automatique si livreur humain déconnecté avant récupération */
      if (o.status === "prete" && !c.isBot && !c.online && o.assignedAt && now - o.assignedAt > 120000) {
        counts.set(c.id, Math.max(0, (counts.get(c.id) ?? 1) - 1));
        await db.update(orders).set({ courierId: null, assignedAt: null }).where(eq(orders.id, o.id));
        o.courierId = null;
        await notify(o.clientId, "info", "Recherche d'un nouveau livreur", "Votre livreur s'est déconnecté ; nous réattribuons votre commande.", o.id);
        await tryAssign(o, shop, cs, uMap, counts);
        continue;
      }

      if (c.isBot) {
        if (o.status === "prete" && o.assignedAt && o.etaPickup && o.routeFrom) {
          const t = (now - o.assignedAt) / Math.max(1, o.etaPickup - o.assignedAt);
          const lat = lerp(o.routeFrom.lat, shop.lat, t) + 0.0008 * Math.sin(Math.PI * clamp(t, 0, 1));
          const lng = lerp(o.routeFrom.lng, shop.lng, t);
          await db.update(couriers).set({ lat, lng, lastSeen: now }).where(eq(couriers.id, c.id));
          c.lat = lat;
          c.lng = lng;
          if (t >= 1) await pickupOrder(o, shop, c.vehicle);
        } else if (o.status === "en_livraison" && o.pickedAt && o.etaDrop) {
          const t = (now - o.pickedAt) / Math.max(1, o.etaDrop - o.pickedAt);
          const lat = lerp(shop.lat, o.lat, t) + 0.0011 * Math.sin(Math.PI * clamp(t, 0, 1));
          const lng = lerp(shop.lng, o.lng, t) - 0.0007 * Math.sin(Math.PI * clamp(t, 0, 1));
          await db.update(couriers).set({ lat, lng, lastSeen: now }).where(eq(couriers.id, c.id));
          c.lat = lat;
          c.lng = lng;
          if (t >= 1) {
            await deliverOrder(o, c);
            counts.set(c.id, Math.max(0, (counts.get(c.id) ?? 1) - 1));
          }
        }
      }

      if (o.status === "recuperee" && now - o.statusAt > 5000) {
        await pushStatus(o, "en_livraison", "Livraison en cours");
        await notify(o.clientId, "livreur", "Votre livreur est en route 🛵", `Suivez sa position en direct jusqu'à chez vous.`, o.id);
      }

      if (o.status === "en_livraison" && !o.approachNotified && havKm(c.lat, c.lng, o.lat, o.lng) < 0.45) {
        await db.update(orders).set({ approachNotified: true }).where(eq(orders.id, o.id));
        o.approachNotified = true;
        await notify(o.clientId, "livreur", "Votre livreur approche 🔔", "Il sera devant chez vous d'ici quelques instants.", o.id);
      }
    }
  }

  /* Dérive légère des livreurs simulés inactifs (vie du secteur) */
  for (const c of cs) {
    if (!c.isBot || !c.online || (counts.get(c.id) ?? 0) > 0) continue;
    const lat = c.centerLat + 0.0035 * Math.sin(now / 90000 + c.id * 2.1);
    const lng = c.centerLng + 0.005 * Math.cos(now / 90000 + c.id * 2.1);
    await db.update(couriers).set({ lat, lng, lastSeen: now }).where(eq(couriers.id, c.id));
  }
}