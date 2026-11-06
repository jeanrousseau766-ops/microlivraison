import { NextRequest } from "next/server";
import { eq, desc, inArray, and } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  merchants,
  products,
  couriers,
  orders,
  notifications,
  transactions,
  payouts,
  disputes,
  adminLogs,
} from "@/db/schema";
import type { OrderStatus } from "@/db/schema";
import { currentUser, ApiError } from "@/lib/auth";
import { ensureSeed, getConfig, sectorStats, activeCounts } from "@/lib/core";
import { maybeTick } from "@/lib/engine";
import { ACTIVE_STATUSES, merchantOpen, serviceOpen, VEHICLES } from "@/lib/util";

export const dynamic = "force-dynamic";

type User = typeof users.$inferSelect;
type Order = typeof orders.$inferSelect;

function safeUser(u: User) {
  return {
    id: u.id,
    pseudo: u.pseudo,
    role: u.role,
    status: u.status,
    statusNote: u.statusNote,
    displayName: u.displayName,
    email: u.email,
    phone: u.phone,
    address: u.address,
    profile: u.profile,
    createdAt: u.createdAt,
  };
}

const MISSION_STATUSES: OrderStatus[] = ["prete", "recuperee", "en_livraison"];

export async function GET(req: NextRequest) {
  try {
    await ensureSeed();
    const scope = req.nextUrl.searchParams.get("scope") ?? "public";
    if (scope !== "checkPseudo") await maybeTick();
    const me = await currentUser();

    if (scope === "checkPseudo") {
      const pseudo = (req.nextUrl.searchParams.get("pseudo") ?? "").trim().toLowerCase();
      const ok = /^[a-z0-9_.-]{3,20}$/.test(pseudo);
      const rows = ok
        ? await db.select({ id: users.id }).from(users).where(eq(users.pseudo, pseudo)).limit(1)
        : [];
      return Response.json({ valid: ok, available: ok && rows.length === 0 });
    }

    if (scope === "public") {
      const cfg = await getConfig();
      const ms = await db
        .select({ m: merchants, u: users })
        .from(merchants)
        .innerJoin(users, eq(merchants.userId, users.id))
        .where(eq(users.status, "active"));
      const ids = ms.map((x) => x.m.id);
      const prods = ids.length
        ? await db.select().from(products).where(inArray(products.merchantId, ids))
        : [];
      const online = await db
        .select({ c: couriers })
        .from(couriers)
        .innerJoin(users, eq(couriers.userId, users.id))
        .where(and(eq(couriers.online, true), eq(users.status, "active")));
      return Response.json({
        config: cfg,
        serviceOpen: serviceOpen(cfg),
        merchants: ms.map(({ m }) => ({ ...m, open: merchantOpen(m) })),
        products: prods,
        stats: {
          merchantsOpen: ms.filter(({ m }) => merchantOpen(m)).length,
          merchantsTotal: ms.length,
          couriersOnline: online.length,
          products: prods.filter((p) => p.available).length,
        },
      });
    }

    if (scope === "me") {
      if (!me) return Response.json({ user: null, unread: 0, notifications: [] });
      const notifs = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, me.id))
        .orderBy(desc(notifications.createdAt))
        .limit(15);
      const courier =
        me.role === "livreur"
          ? (await db.select().from(couriers).where(eq(couriers.userId, me.id)).limit(1))[0] ?? null
          : null;
      const merchant =
        me.role === "commercant"
          ? (await db.select().from(merchants).where(eq(merchants.userId, me.id)).limit(1))[0] ?? null
          : null;
      return Response.json({
        user: safeUser(me),
        courier,
        merchant,
        unread: notifs.filter((n) => !n.read).length,
        notifications: notifs,
      });
    }

    if (!me) throw new ApiError(401, "Connexion requise.");

    if (scope === "client") {
      const my = await db
        .select()
        .from(orders)
        .where(eq(orders.clientId, me.id))
        .orderBy(desc(orders.createdAt))
        .limit(30);
      const ms = await db.select().from(merchants);
      const mMap = new Map(ms.map((m) => [m.id, m]));
      const cIds = my.map((o) => o.courierId).filter((x): x is number => !!x);
      const cs = cIds.length
        ? await db.select({ c: couriers, u: users }).from(couriers).innerJoin(users, eq(couriers.userId, users.id)).where(inArray(couriers.id, cIds))
        : [];
      const cMap = new Map(cs.map((x) => [x.c.id, x]));
      return Response.json({
        orders: my.map((o) => {
          const cm = o.courierId ? cMap.get(o.courierId) : undefined;
          const showCourier = cm && MISSION_STATUSES.includes(o.status);
          return {
            ...orderBrief(o),
            merchantName: mMap.get(o.merchantId)?.name ?? "Commerce",
            merchantEmoji: mMap.get(o.merchantId)?.emoji ?? "🏪",
            courier: showCourier
              ? { name: cm.u.displayName, vehicle: cm.c.vehicle, lat: cm.c.lat, lng: cm.c.lng }
              : null,
          };
        }),
      });
    }

    if (scope === "order") {
      const id = Number(req.nextUrl.searchParams.get("id") ?? 0);
      const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
      const o = rows[0];
      if (!o) throw new ApiError(404, "Commande introuvable.");
      const isOwner = o.clientId === me.id;
      const isAdmin = me.role === "admin";
      const shopRow = await db.select().from(merchants).where(eq(merchants.id, o.merchantId)).limit(1);
      const shop = shopRow[0];
      const isMerchantOwner = me.role === "commercant" && shop?.userId === me.id;
      let courierRow: { c: typeof couriers.$inferSelect; u: User } | undefined;
      if (o.courierId) {
        const cr = await db
          .select({ c: couriers, u: users })
          .from(couriers)
          .innerJoin(users, eq(couriers.userId, users.id))
          .where(eq(couriers.id, o.courierId))
          .limit(1);
        courierRow = cr[0];
      }
      const isCourierOwner = courierRow?.u.id === me.id;
      if (!isOwner && !isAdmin && !isMerchantOwner && !isCourierOwner)
        throw new ApiError(403, "Cette commande ne vous concerne pas.");
      const showPos = courierRow && (MISSION_STATUSES.includes(o.status) || isAdmin);
      const dsp = await db.select().from(disputes).where(eq(disputes.orderId, o.id)).limit(1);
      return Response.json({
        order: o,
        merchant: shop
          ? { id: shop.id, name: shop.name, emoji: shop.emoji, cover: shop.cover, address: shop.address, lat: shop.lat, lng: shop.lng, category: shop.category }
          : null,
        courier:
          courierRow && showPos
            ? { name: courierRow.u.displayName, vehicle: courierRow.c.vehicle, lat: courierRow.c.lat, lng: courierRow.c.lng, phone: courierRow.u.phone }
            : courierRow && (isOwner || isCourierOwner)
              ? { name: courierRow.u.displayName, vehicle: courierRow.c.vehicle, lat: null, lng: null, phone: "" }
              : null,
        dispute: dsp[0] ?? null,
        isOwner,
        canCancel: isOwner && ["payee", "acceptee", "preparation"].includes(o.status),
      });
    }

    if (scope === "courier") {
      if (me.role !== "livreur") throw new ApiError(403, "Espace réservé aux livreurs.");
      const c = (await db.select().from(couriers).where(eq(couriers.userId, me.id)).limit(1))[0];
      if (!c) throw new ApiError(404, "Profil livreur introuvable.");
      const cfg = await getConfig();
      const sector = await sectorStats(c.centerLat, c.centerLng, c.radiusKm);
      const mine = await db
        .select()
        .from(orders)
        .where(eq(orders.courierId, c.id))
        .orderBy(desc(orders.createdAt))
        .limit(120);
      const missions = mine.filter((o) => MISSION_STATUSES.includes(o.status));
      const history = mine.filter((o) => !MISSION_STATUSES.includes(o.status)).slice(0, 15);
      const ms = await db.select().from(merchants);
      const mMap = new Map(ms.map((m) => [m.id, m]));
      const enrich = (o: Order) => ({
        ...orderBrief(o),
        merchantName: mMap.get(o.merchantId)?.name ?? "",
        merchantEmoji: mMap.get(o.merchantId)?.emoji ?? "",
        merchantAddress: mMap.get(o.merchantId)?.address ?? "",
        merchantLat: mMap.get(o.merchantId)?.lat ?? 0,
        merchantLng: mMap.get(o.merchantId)?.lng ?? 0,
        lat: o.lat,
        lng: o.lng,
        phone: o.phone,
        addressExtra: o.addressExtra,
        gain: o.feeBreakdown?.courierShare ?? Math.round(o.deliveryFee * 0.7),
        itemCount: o.items.reduce((s, i) => s + i.qty, 0),
      });
      const tx = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.partyRole, "livreur"), eq(transactions.partyId, c.id)));
      const earned = tx.filter((t) => t.kind === "part_livreur");
      const now = Date.now();
      const dayStart = new Date(new Date(now).toLocaleDateString("en-US", { timeZone: "Europe/Paris" })).getTime();
      const sum = (list: typeof earned) => list.reduce((s, t) => s + t.amount, 0);
      const total = sum(earned);
      const myPayouts = await db
        .select()
        .from(payouts)
        .where(eq(payouts.courierId, c.id))
        .orderBy(desc(payouts.createdAt));
      const paidOut = myPayouts.filter((p) => p.status === "verse").reduce((s, p) => s + p.amount, 0);
      const pendingPayout = myPayouts.filter((p) => p.status === "demande").reduce((s, p) => s + p.amount, 0);
      const series: { day: string; amount: number }[] = [];
      for (let d = 13; d >= 0; d--) {
        const start = dayStart - d * 86400000;
        const end = start + 86400000;
        series.push({
          day: new Date(start).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
          amount: sum(earned.filter((t) => t.createdAt >= start && t.createdAt < end)),
        });
      }
      const delivered = mine.filter((o) => o.status === "livree");
      const fees = delivered.reduce(
        (s, o) => s + (o.deliveryFee - (o.feeBreakdown?.courierShare ?? Math.round(o.deliveryFee * 0.7))),
        0
      );
      return Response.json({
        courier: c,
        config: { maxCapacity: cfg.maxCapacity, maxRadiusKm: cfg.maxRadiusKm, minPayout: cfg.minPayout, openHour: cfg.openHour, closeHour: cfg.closeHour, serviceOpen: serviceOpen(cfg), courierSharePercent: cfg.courierSharePercent },
        sector,
        missions: missions.map(enrich),
        history: history.map(enrich),
        earnings: {
          today: sum(earned.filter((t) => t.createdAt >= dayStart)),
          week: sum(earned.filter((t) => t.createdAt >= now - 7 * 86400000)),
          month: sum(earned.filter((t) => t.createdAt >= now - 30 * 86400000)),
          total,
          deliveredCount: delivered.length,
          cancelledCount: mine.filter((o) => o.status === "annulee" || o.status === "refusee").length,
          fees,
          available: Math.max(0, total - paidOut - pendingPayout),
          paidOut,
          pendingPayout,
          series,
        },
        payouts: myPayouts.slice(0, 10),
      });
    }

    if (scope === "merchant") {
      if (me.role !== "commercant") throw new ApiError(403, "Espace réservé aux commerçants.");
      const m = (await db.select().from(merchants).where(eq(merchants.userId, me.id)).limit(1))[0];
      if (!m) throw new ApiError(404, "Boutique introuvable.");
      const prods = await db
        .select()
        .from(products)
        .where(eq(products.merchantId, m.id))
        .orderBy(products.id);
      const os = await db
        .select()
        .from(orders)
        .where(eq(orders.merchantId, m.id))
        .orderBy(desc(orders.createdAt))
        .limit(60);
      const clients = await db.select().from(users).where(eq(users.role, "client"));
      const clMap = new Map(clients.map((u) => [u.id, u]));
      const now = Date.now();
      const dayStart = new Date(new Date(now).toLocaleDateString("en-US", { timeZone: "Europe/Paris" })).getTime();
      const delivered = os.filter((o) => o.status === "livree");
      const tx = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.partyRole, "commercant"), eq(transactions.partyId, m.id)));
      const owed =
        tx.filter((t) => t.kind === "produits_commercant").reduce((s, t) => s + t.amount, 0) -
        tx.filter((t) => t.kind === "reversement_commercant").reduce((s, t) => s + t.amount, 0);
      return Response.json({
        merchant: { ...m, open: merchantOpen(m) },
        products: prods,
        orders: os.map((o) => ({
          ...orderBrief(o),
          clientName: clMap.get(o.clientId)?.displayName ?? clMap.get(o.clientId)?.pseudo ?? "Client",
          recipient: o.recipient,
          address: o.address,
          urgent: o.urgent,
        })),
        stats: {
          today: delivered.filter((o) => (o.deliveredAt ?? 0) >= dayStart).reduce((s, o) => s + o.itemsTotal, 0),
          week: delivered.filter((o) => (o.deliveredAt ?? 0) >= now - 7 * 86400000).reduce((s, o) => s + o.itemsTotal, 0),
          owed,
          deliveredCount: delivered.length,
        },
      });
    }

    if (scope === "admin") {
      if (me.role !== "admin") throw new ApiError(403, "Espace réservé à l'administration.");
      const cfg = await getConfig();
      const us = await db.select().from(users);
      const ms = await db.select().from(merchants);
      const cs = await db.select().from(couriers);
      const os = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(80);
      const tx = await db.select().from(transactions);
      const ps = await db.select().from(payouts).orderBy(desc(payouts.createdAt));
      const ds = await db.select().from(disputes).orderBy(desc(disputes.createdAt));
      const logs = await db.select().from(adminLogs).orderBy(desc(adminLogs.createdAt)).limit(50);
      const counts = await activeCounts();
      const uMap = new Map(us.map((u) => [u.id, u]));
      const mMap = new Map(ms.map((m) => [m.id, m]));
      const cMap = new Map(cs.map((c) => [c.id, c]));
      const sum = (kind: string) => tx.filter((t) => t.kind === kind).reduce((s, t) => s + t.amount, 0);
      const delivered = os.filter((o) => o.status === "livree");
      const now = Date.now();
      const series: { day: string; amount: number; count: number }[] = [];
      const dayStart = new Date(new Date(now).toLocaleDateString("en-US", { timeZone: "Europe/Paris" })).getTime();
      const allDelivered = await db.select().from(orders).where(eq(orders.status, "livree"));
      for (let d = 13; d >= 0; d--) {
        const start = dayStart - d * 86400000;
        const end = start + 86400000;
        const dayOrders = allDelivered.filter((o) => (o.deliveredAt ?? 0) >= start && (o.deliveredAt ?? 0) < end);
        series.push({
          day: new Date(start).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
          amount: dayOrders.reduce((s, o) => s + o.total, 0),
          count: dayOrders.length,
        });
      }
      const courierEarned = (cid: number) =>
        tx.filter((t) => t.kind === "part_livreur" && t.partyId === cid).reduce((s, t) => s + t.amount, 0);
      const courierPaid = (cid: number) =>
        ps.filter((p) => p.courierId === cid && p.status === "verse").reduce((s, p) => s + p.amount, 0);
      const merchantRevenue = (mid: number) =>
        tx.filter((t) => t.kind === "produits_commercant" && t.partyId === mid).reduce((s, t) => s + t.amount, 0);
      const merchantSettled = (mid: number) =>
        tx.filter((t) => t.kind === "reversement_commercant" && t.partyId === mid).reduce((s, t) => s + t.amount, 0);
      const prodCounts = await db.select().from(products);
      return Response.json({
        config: cfg,
        kpis: {
          clients: us.filter((u) => u.role === "client").length,
          couriers: us.filter((u) => u.role === "livreur").length,
          couriersActive: cs.filter((c) => c.online && uMap.get(c.userId)?.status === "active").length,
          merchants: ms.filter((m) => uMap.get(m.userId)?.status === "active").length,
          ordersActive: os.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
          ordersDone: allDelivered.length,
          ca: allDelivered.reduce((s, o) => s + o.total, 0),
          platformRevenue: sum("part_plateforme"),
          owedCouriers: sum("part_livreur") - sum("versement_livreur"),
          owedMerchants: sum("produits_commercant") - sum("reversement_commercant"),
          disputesOpen: ds.filter((d) => d.status === "ouvert" || d.status === "en_cours").length,
          payoutsPending: ps.filter((p) => p.status === "demande").length,
        },
        series,
        applications: us
          .filter((u) => (u.role === "livreur" || u.role === "commercant") && (u.status === "pending" || u.status === "docs_required"))
          .map((u) => ({
            ...safeUser(u),
            courier: cs.find((c) => c.userId === u.id) ?? null,
            merchant: ms.find((m) => m.userId === u.id) ?? null,
          })),
        clients: us
          .filter((u) => u.role === "client")
          .map((u) => ({ ...safeUser(u), ordersCount: os.filter((o) => o.clientId === u.id).length })),
        couriers: cs.map((c) => {
          const u = uMap.get(c.userId);
          return {
            id: c.id,
            userId: c.userId,
            name: u?.displayName ?? u?.pseudo ?? "?",
            status: u?.status ?? "disabled",
            vehicle: c.vehicle,
            online: c.online,
            isBot: c.isBot,
            capacity: c.capacity,
            active: counts.get(c.id) ?? 0,
            remaining: Math.max(0, c.capacity - (counts.get(c.id) ?? 0)),
            centerLat: c.centerLat,
            centerLng: c.centerLng,
            radiusKm: c.radiusKm,
            lat: c.lat,
            lng: c.lng,
            delivered: allDelivered.filter((o) => o.courierId === c.id).length,
            earned: courierEarned(c.id),
            available: Math.max(0, courierEarned(c.id) - courierPaid(c.id)),
          };
        }),
        merchants: ms.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.name,
          emoji: m.emoji,
          category: m.category,
          status: uMap.get(m.userId)?.status ?? "disabled",
          open: merchantOpen(m),
          siret: m.siret,
          legalName: m.legalName,
          address: m.address,
          docs: m.docs,
          products: prodCounts.filter((p) => p.merchantId === m.id).length,
          ordersCount: os.filter((o) => o.merchantId === m.id).length,
          revenue: merchantRevenue(m.id),
          owed: merchantRevenue(m.id) - merchantSettled(m.id),
          lat: m.lat,
          lng: m.lng,
        })),
        orders: os.map((o) => {
          const c = o.courierId ? cMap.get(o.courierId) : null;
          const blocked =
            (o.status === "prete" && !o.courierId && now - o.statusAt > 180000) ||
            (o.status === "prete" && !!c && !c.isBot && !!o.assignedAt && now - o.assignedAt > 300000);
          return {
            ...orderBrief(o),
            clientName: uMap.get(o.clientId)?.displayName ?? "?",
            merchantName: mMap.get(o.merchantId)?.name ?? "?",
            courierName: c ? uMap.get(c.userId)?.displayName ?? "?" : null,
            blocked,
            address: o.address,
          };
        }),
        disputes: ds.map((d) => ({
          ...d,
          orderCode: os.find((o) => o.id === d.orderId)?.code ?? `#${d.orderId}`,
          orderTotal: os.find((o) => o.id === d.orderId)?.total ?? 0,
          clientName: uMap.get(d.clientId)?.displayName ?? "?",
        })),
        payouts: ps.slice(0, 15).map((p) => {
          const c = cMap.get(p.courierId);
          return { ...p, courierName: c ? uMap.get(c.userId)?.displayName ?? "?" : "?" };
        }),
        logs,
        onlineCouriersForReassign: cs
          .filter((c) => c.online && uMap.get(c.userId)?.status === "active")
          .map((c) => ({
            id: c.id,
            name: uMap.get(c.userId)?.displayName ?? "?",
            remaining: Math.max(0, c.capacity - (counts.get(c.id) ?? 0)),
            vehicle: VEHICLES[c.vehicle]?.label ?? c.vehicle,
          })),
        deliveredRecent: delivered.length,
      });
    }

    throw new ApiError(400, "Portée inconnue.");
  } catch (e) {
    if (e instanceof ApiError) return Response.json({ error: e.message }, { status: e.status });
    console.error("[state]", e);
    return Response.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

function orderBrief(o: Order) {
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    statusAt: o.statusAt,
    createdAt: o.createdAt,
    items: o.items,
    itemsTotal: o.itemsTotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    urgent: o.urgent,
    address: o.address,
    recipient: o.recipient,
    distanceKm: o.distanceKm,
    prepMinutes: o.prepMinutes,
    etaDrop: o.etaDrop,
    merchantId: o.merchantId,
    timeline: o.timeline,
    cancelReason: o.cancelReason,
    courierId: o.courierId,
  };
}