import { NextRequest } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  sessions,
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
import type { DocEntry, OrderItem, UserStatus } from "@/db/schema";
import {
  ApiError,
  currentUser,
  requireUser,
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
  loginGuard,
  loginFail,
  loginOk,
} from "@/lib/auth";
import { ensureSeed, getConfig, saveConfig, notify, activeCounts } from "@/lib/core";
import { pushStatus, tryAssign, pickupOrder, deliverOrder, refundOrder, travelMs } from "@/lib/engine";
import {
  Config,
  computeFee,
  feeTotal,
  roadKm,
  serviceOpen,
  merchantOpen,
  clamp,
  LOCHES,
  euro,
} from "@/lib/util";

export const dynamic = "force-dynamic";

const s = (v: unknown) => String(v ?? "").trim();
const n = (v: unknown) => Number(v ?? 0);
const b = (v: unknown) => Boolean(v);

async function log(adminId: number, action: string, target: string, details: string) {
  await db.insert(adminLogs).values({ adminId, action, target, details, createdAt: Date.now() });
}

async function notifyAdmins(title: string, body: string) {
  const admins = await db.select().from(users).where(eq(users.role, "admin"));
  for (const a of admins) await notify(a.id, "admin", title, body);
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeed();
    const body = (await req.json()) as { action?: string; payload?: Record<string, unknown> };
    const action = s(body.action);
    const p = body.payload ?? {};
    const now = Date.now();

    switch (action) {
      /* ================= AUTH ================= */
      case "register": {
        const pseudo = s(p.pseudo).toLowerCase();
        const password = s(p.password);
        if (!/^[a-z0-9_.-]{3,20}$/.test(pseudo))
          throw new ApiError(400, "Pseudonyme : 3 à 20 caractères (lettres, chiffres, . _ -).");
        if (password.length < 6) throw new ApiError(400, "Mot de passe : 6 caractères minimum.");
        const exists = await db.select({ id: users.id }).from(users).where(eq(users.pseudo, pseudo)).limit(1);
        if (exists.length) throw new ApiError(409, "Ce pseudonyme est déjà pris.");
        const [u] = await db
          .insert(users)
          .values({ pseudo, passwordHash: hashPassword(password), role: "client", displayName: pseudo, createdAt: now })
          .returning();
        await createSession(u.id);
        await notify(u.id, "info", "Bienvenue sur Locho 👋", "Votre compte est créé. Les informations de livraison vous seront demandées à la commande.");
        return Response.json({ ok: true, role: "client" });
      }

      case "login": {
        const pseudo = s(p.pseudo).toLowerCase();
        loginGuard(pseudo);
        const rows = await db.select().from(users).where(eq(users.pseudo, pseudo)).limit(1);
        const u = rows[0];
        if (!u || !verifyPassword(s(p.password), u.passwordHash)) {
          loginFail(pseudo);
          throw new ApiError(401, "Pseudonyme ou mot de passe incorrect.");
        }
        if (u.status === "disabled") throw new ApiError(403, "Ce compte a été désactivé.");
        loginOk(pseudo);
        await createSession(u.id);
        return Response.json({ ok: true, role: u.role, status: u.status });
      }

      case "logout": {
        await destroySession();
        return Response.json({ ok: true });
      }

      case "applyLivreur": {
        const pseudo = s(p.pseudo).toLowerCase();
        const password = s(p.password);
        if (!/^[a-z0-9_.-]{3,20}$/.test(pseudo)) throw new ApiError(400, "Pseudonyme invalide (3–20 caractères).");
        if (password.length < 6) throw new ApiError(400, "Mot de passe : 6 caractères minimum.");
        if (!s(p.displayName) || !s(p.email) || !s(p.phone) || !s(p.birthDate))
          throw new ApiError(400, "Identité incomplète (nom, e-mail, téléphone, date de naissance).");
        if (!s(p.iban)) throw new ApiError(400, "Coordonnées bancaires requises pour le versement de vos revenus.");
        const exists = await db.select({ id: users.id }).from(users).where(eq(users.pseudo, pseudo)).limit(1);
        if (exists.length) throw new ApiError(409, "Ce pseudonyme est déjà pris.");
        const vehicle = s(p.vehicle) || "velo";
        const [u] = await db
          .insert(users)
          .values({
            pseudo,
            passwordHash: hashPassword(password),
            role: "livreur",
            status: "pending",
            displayName: s(p.displayName),
            email: s(p.email),
            phone: s(p.phone),
            address: s(p.address),
            profile: {
              statut: s(p.statut),
              siren: s(p.siren),
              birthDate: s(p.birthDate),
              iban: s(p.iban),
              immat: s(p.immat),
              permis: s(p.permis),
              insuranceExp: s(p.insuranceExp),
              docs: (p.docs as DocEntry[]) ?? [],
            },
            createdAt: now,
          })
          .returning();
        await db.insert(couriers).values({
          userId: u.id,
          vehicle,
          online: false,
          capacity: 5,
          centerLat: LOCHES.lat,
          centerLng: LOCHES.lng,
          radiusKm: 5,
          lat: LOCHES.lat,
          lng: LOCHES.lng,
          createdAt: now,
        });
        await createSession(u.id);
        await notify(u.id, "info", "Dossier transmis ✔", "L'administration vérifie vos justificatifs. Vous serez notifié de la décision.");
        await notifyAdmins("Nouvelle candidature livreur", `${u.displayName} (${vehicle}) — dossier en attente de validation.`);
        return Response.json({ ok: true, role: "livreur" });
      }

      case "applyCommercant": {
        const pseudo = s(p.pseudo).toLowerCase();
        const password = s(p.password);
        if (!/^[a-z0-9_.-]{3,20}$/.test(pseudo)) throw new ApiError(400, "Pseudonyme invalide (3–20 caractères).");
        if (password.length < 6) throw new ApiError(400, "Mot de passe : 6 caractères minimum.");
        if (!s(p.name) || !s(p.legalName) || !s(p.siret) || !s(p.email) || !s(p.address))
          throw new ApiError(400, "Informations obligatoires manquantes (nom, raison sociale, SIRET, e-mail, adresse).");
        const exists = await db.select({ id: users.id }).from(users).where(eq(users.pseudo, pseudo)).limit(1);
        if (exists.length) throw new ApiError(409, "Ce pseudonyme est déjà pris.");
        const [u] = await db
          .insert(users)
          .values({
            pseudo,
            passwordHash: hashPassword(password),
            role: "commercant",
            status: "pending",
            displayName: s(p.representative) || s(p.name),
            email: s(p.email),
            phone: s(p.phone),
            address: s(p.address),
            profile: { iban: s(p.iban), representative: s(p.representative), docs: (p.docs as DocEntry[]) ?? [] },
            createdAt: now,
          })
          .returning();
        const cfg = await getConfig();
        const category = cfg.categories.includes(s(p.category)) ? s(p.category) : cfg.categories[0];
        await db.insert(merchants).values({
          userId: u.id,
          name: s(p.name),
          legalName: s(p.legalName),
          siret: s(p.siret),
          category,
          description: s(p.description),
          emoji: s(p.emoji) || "🏪",
          cover: "ambre",
          address: s(p.address),
          lat: LOCHES.lat + ((u.id * 37) % 10) * 0.0006 - 0.003,
          lng: LOCHES.lng + ((u.id * 53) % 10) * 0.0008 - 0.004,
          openHour: clamp(n(p.openHour) || 9, 0, 23),
          closeHour: clamp(n(p.closeHour) || 19, 1, 23),
          autoManage: false,
          docs: (p.docs as DocEntry[]) ?? [],
          createdAt: now,
        });
        await createSession(u.id);
        await notify(u.id, "info", "Dossier transmis ✔", "Votre boutique sera visible après validation par l'administration.");
        await notifyAdmins("Nouvelle demande commerçant", `${s(p.name)} (${category}) — dossier en attente de validation.`);
        return Response.json({ ok: true, role: "commercant" });
      }

      case "resubmitDocs": {
        const me = await requireUser();
        if (me.status !== "docs_required" && me.status !== "pending")
          throw new ApiError(400, "Aucun document n'est attendu pour ce compte.");
        const docs = (p.docs as DocEntry[]) ?? [];
        await db
          .update(users)
          .set({ status: "pending", statusNote: "", profile: { ...me.profile, docs: [...((me.profile.docs as DocEntry[]) ?? []), ...docs] } })
          .where(eq(users.id, me.id));
        await notifyAdmins("Documents complémentaires reçus", `${me.displayName || me.pseudo} a transmis de nouvelles pièces.`);
        return Response.json({ ok: true });
      }

      case "deleteAccount": {
        const me = await requireUser();
        const myActive = await db
          .select()
          .from(orders)
          .where(and(eq(orders.clientId, me.id), inArray(orders.status, ["payee", "acceptee", "preparation", "prete"] )));
        for (const o of myActive) await refundOrder(o, "annulee", "Compte supprimé à la demande du client (RGPD)");
        if (me.role === "livreur")
          await db.update(couriers).set({ online: false }).where(eq(couriers.userId, me.id));
        await db
          .update(users)
          .set({
            pseudo: `supprime_${me.id}`,
            displayName: "Compte supprimé",
            email: "",
            phone: "",
            address: "",
            profile: {},
            status: "disabled",
            passwordHash: ":",
          })
          .where(eq(users.id, me.id));
        await db.delete(sessions).where(eq(sessions.userId, me.id));
        await log(me.id, "Suppression de compte (RGPD)", `Utilisateur #${me.id}`, "Anonymisation des données personnelles et désactivation.");
        await destroySession();
        return Response.json({ ok: true });
      }

      /* ================= CLIENT ================= */
      case "createOrder": {
        const me = await requireUser();
        if (me.role !== "client") throw new ApiError(403, "Connectez-vous avec un compte client pour commander.");
        if (me.status !== "active") throw new ApiError(403, "Votre compte est suspendu : commande impossible.");
        const cfg = await getConfig();
        if (!serviceOpen(cfg))
          throw new ApiError(400, `Le service est fermé. Livraisons tous les jours de ${cfg.openHour}h à ${cfg.closeHour}h.`);
        const shop = (await db.select().from(merchants).where(eq(merchants.id, n(p.merchantId))).limit(1))[0];
        if (!shop) throw new ApiError(404, "Commerce introuvable.");
        const shopUser = (await db.select().from(users).where(eq(users.id, shop.userId)).limit(1))[0];
        if (!shopUser || shopUser.status !== "active") throw new ApiError(400, "Ce commerce n'est pas disponible.");
        if (!merchantOpen(shop)) throw new ApiError(400, `${shop.name} est actuellement fermé (${shop.openHour}h–${shop.closeHour}h).`);
        if (!s(p.recipient) || !s(p.phone) || !s(p.address))
          throw new ApiError(400, "Nom du destinataire, téléphone et adresse sont requis.");
        const lat = n(p.lat) || LOCHES.lat;
        const lng = n(p.lng) || LOCHES.lng;
        if (roadKm(shop.lat, shop.lng, lat, lng) > cfg.maxRadiusKm + 4)
          throw new ApiError(400, "Adresse hors zone de livraison desservie.");
        const wanted = (p.items as { productId: number; qty: number }[]) ?? [];
        if (!wanted.length) throw new ApiError(400, "Votre panier est vide.");
        const ids = wanted.map((w) => n(w.productId));
        const prods = await db.select().from(products).where(inArray(products.id, ids));
        const items: OrderItem[] = [];
        for (const w of wanted) {
          const prod = prods.find((x) => x.id === n(w.productId));
          if (!prod || prod.merchantId !== shop.id) throw new ApiError(400, "Article invalide dans le panier.");
          if (!prod.available) throw new ApiError(400, `${prod.name} n'est plus disponible.`);
          const qty = clamp(Math.round(n(w.qty)), 1, 20);
          if (prod.stock < qty) throw new ApiError(400, `Stock insuffisant pour ${prod.name} (${prod.stock} restant).`);
          items.push({ productId: prod.id, name: prod.name, emoji: prod.emoji, price: prod.price, qty });
        }
        for (const it of items) {
          const prod = prods.find((x) => x.id === it.productId)!;
          await db.update(products).set({ stock: prod.stock - it.qty }).where(eq(products.id, prod.id));
        }
        const itemsTotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
        const distanceKm = roadKm(shop.lat, shop.lng, lat, lng);
        const urgent = b(p.urgent);
        const fb = computeFee(cfg, distanceKm, shop.category, urgent);
        const fee = feeTotal(fb);
        const [o] = await db
          .insert(orders)
          .values({
            code: `TMP-${now}`,
            clientId: me.id,
            merchantId: shop.id,
            status: "payee",
            items,
            itemsTotal,
            deliveryFee: fee,
            feeBreakdown: fb,
            urgent,
            total: itemsTotal + fee,
            recipient: s(p.recipient),
            phone: s(p.phone),
            address: s(p.address),
            addressExtra: s(p.addressExtra),
            lat,
            lng,
            distanceKm,
            createdAt: now,
            statusAt: now,
            timeline: [
              { status: "creee", at: now - 1500, label: "Commande effectuée" },
              { status: "payee", at: now, label: "Paiement confirmé (PSP démo)" },
            ],
          })
          .returning();
        const code = `LC-${2400 + o.id}`;
        await db.update(orders).set({ code }).where(eq(orders.id, o.id));
        await db.insert(transactions).values({
          orderId: o.id,
          kind: "paiement",
          amount: o.total,
          partyRole: "client",
          partyId: me.id,
          label: `Paiement ${code} — carte via prestataire agréé (démo)`,
          createdAt: now,
        });
        await notify(me.id, "ok", "Commande confirmée ✔", `${code} · ${euro(o.total)} payés. Transmission à ${shop.name}…`, o.id);
        if (!shop.autoManage)
          await notify(shop.userId, "commande", `Nouvelle commande ${code}`, `${items.reduce((x, i) => x + i.qty, 0)} article(s) · ${euro(itemsTotal)} — à accepter dans votre espace.`, o.id);
        return Response.json({ ok: true, orderId: o.id, code });
      }

      case "cancelOrder": {
        const me = await requireUser();
        const o = (await db.select().from(orders).where(eq(orders.id, n(p.orderId))).limit(1))[0];
        if (!o || o.clientId !== me.id) throw new ApiError(404, "Commande introuvable.");
        if (!["payee", "acceptee", "preparation"].includes(o.status))
          throw new ApiError(400, "Trop tard pour annuler en ligne : ouvrez une réclamation.");
        await refundOrder(o, "annulee", "Annulée à votre demande avant préparation avancée");
        const shop = (await db.select().from(merchants).where(eq(merchants.id, o.merchantId)).limit(1))[0];
        if (shop) await notify(shop.userId, "alerte", `Commande ${o.code} annulée`, "Annulation client avant remise au livreur.");
        return Response.json({ ok: true });
      }

      case "markRead": {
        const me = await requireUser();
        await db.update(notifications).set({ read: true }).where(and(eq(notifications.userId, me.id), eq(notifications.read, false)));
        return Response.json({ ok: true });
      }

      case "createDispute": {
        const me = await requireUser();
        const o = (await db.select().from(orders).where(eq(orders.id, n(p.orderId))).limit(1))[0];
        if (!o || o.clientId !== me.id) throw new ApiError(404, "Commande introuvable.");
        if (!s(p.reason)) throw new ApiError(400, "Choisissez un motif.");
        const existing = await db
          .select()
          .from(disputes)
          .where(and(eq(disputes.orderId, o.id), inArray(disputes.status, ["ouvert", "en_cours"])));
        if (existing.length) throw new ApiError(400, "Une réclamation est déjà ouverte pour cette commande.");
        await db.insert(disputes).values({
          orderId: o.id,
          clientId: me.id,
          reason: s(p.reason),
          details: s(p.details),
          createdAt: now,
        });
        await notifyAdmins("Nouvelle réclamation", `${o.code} · ${s(p.reason)} — à traiter.`);
        await notify(me.id, "info", "Réclamation transmise", "L'administration vous répondra au plus vite.");
        return Response.json({ ok: true });
      }

      /* ================= LIVREUR ================= */
      case "courierOnline": {
        const me = await requireUser(["livreur"]);
        if (me.status !== "active") throw new ApiError(403, "Votre dossier doit être validé avant toute livraison.");
        const cfg = await getConfig();
        if (!serviceOpen(cfg))
          throw new ApiError(400, `Connexion possible uniquement pendant la plage de service (${cfg.openHour}h–${cfg.closeHour}h).`);
        const c = (await db.select().from(couriers).where(eq(couriers.userId, me.id)).limit(1))[0];
        if (!c) throw new ApiError(404, "Profil livreur introuvable.");
        const capacity = clamp(Math.round(n(p.capacity)) || 5, 1, cfg.maxCapacity);
        const radiusKm = clamp(n(p.radiusKm) || c.radiusKm, 1, cfg.maxRadiusKm);
        const centerLat = n(p.centerLat) || c.centerLat;
        const centerLng = n(p.centerLng) || c.centerLng;
        await db
          .update(couriers)
          .set({ online: true, capacity, radiusKm, centerLat, centerLng, lastSeen: now })
          .where(eq(couriers.id, c.id));
        return Response.json({ ok: true });
      }

      case "courierOffline": {
        const me = await requireUser(["livreur"]);
        await db.update(couriers).set({ online: false, lastSeen: now }).where(eq(couriers.userId, me.id));
        return Response.json({ ok: true });
      }

      case "courierZone": {
        const me = await requireUser(["livreur"]);
        const cfg = await getConfig();
        const patch: Partial<typeof couriers.$inferInsert> = { lastSeen: now };
        if (p.capacity !== undefined) patch.capacity = clamp(Math.round(n(p.capacity)), 1, cfg.maxCapacity);
        if (p.radiusKm !== undefined) patch.radiusKm = clamp(n(p.radiusKm), 1, cfg.maxRadiusKm);
        if (p.centerLat !== undefined && p.centerLng !== undefined) {
          patch.centerLat = n(p.centerLat);
          patch.centerLng = n(p.centerLng);
        }
        await db.update(couriers).set(patch).where(eq(couriers.userId, me.id));
        return Response.json({ ok: true });
      }

      case "courierPosition": {
        const me = await requireUser(["livreur"]);
        const lat = n(p.lat);
        const lng = n(p.lng);
        if (!lat || !lng) throw new ApiError(400, "Position invalide.");
        await db.update(couriers).set({ lat, lng, lastSeen: now }).where(eq(couriers.userId, me.id));
        return Response.json({ ok: true });
      }

      case "courierPicked": {
        const me = await requireUser(["livreur"]);
        const c = (await db.select().from(couriers).where(eq(couriers.userId, me.id)).limit(1))[0];
        const o = (await db.select().from(orders).where(eq(orders.id, n(p.orderId))).limit(1))[0];
        if (!c || !o || o.courierId !== c.id) throw new ApiError(404, "Mission introuvable.");
        if (o.status !== "prete") throw new ApiError(400, "Cette commande n'est pas prête à être récupérée.");
        const shop = (await db.select().from(merchants).where(eq(merchants.id, o.merchantId)).limit(1))[0];
        if (!shop) throw new ApiError(404, "Commerce introuvable.");
        await pickupOrder(o, shop, c.vehicle);
        return Response.json({ ok: true });
      }

      case "courierDelivered": {
        const me = await requireUser(["livreur"]);
        const c = (await db.select().from(couriers).where(eq(couriers.userId, me.id)).limit(1))[0];
        const o = (await db.select().from(orders).where(eq(orders.id, n(p.orderId))).limit(1))[0];
        if (!c || !o || o.courierId !== c.id) throw new ApiError(404, "Mission introuvable.");
        if (o.status !== "recuperee" && o.status !== "en_livraison")
          throw new ApiError(400, "Récupérez d'abord la commande chez le commerçant.");
        await deliverOrder(o, c);
        return Response.json({ ok: true });
      }

      case "requestPayout": {
        const me = await requireUser(["livreur"]);
        const c = (await db.select().from(couriers).where(eq(couriers.userId, me.id)).limit(1))[0];
        if (!c) throw new ApiError(404, "Profil introuvable.");
        const cfg = await getConfig();
        const tx = await db
          .select()
          .from(transactions)
          .where(and(eq(transactions.partyRole, "livreur"), eq(transactions.partyId, c.id), eq(transactions.kind, "part_livreur")));
        const ps = await db.select().from(payouts).where(eq(payouts.courierId, c.id));
        const available =
          tx.reduce((sum, t) => sum + t.amount, 0) -
          ps.filter((x) => x.status !== "refuse").reduce((sum, x) => sum + x.amount, 0);
        const amount = p.amount ? Math.round(n(p.amount)) : available;
        if (amount < cfg.minPayout)
          throw new ApiError(400, `Versement minimum : ${euro(cfg.minPayout)} (solde disponible : ${euro(available)}).`);
        if (amount > available) throw new ApiError(400, `Solde disponible insuffisant (${euro(available)}).`);
        await db.insert(payouts).values({ courierId: c.id, amount, createdAt: now });
        await notifyAdmins("Demande de versement", `${me.displayName} demande ${euro(amount)}.`);
        await notify(me.id, "info", "Demande de versement envoyée", `${euro(amount)} — traitement sous 2 jours ouvrés (PSP démo).`);
        return Response.json({ ok: true });
      }

      /* ================= COMMERÇANT ================= */
      case "merchantAccept":
      case "merchantRefuse":
      case "merchantPreparing":
      case "merchantReady": {
        const me = await requireUser(["commercant"]);
        if (me.status !== "active") throw new ApiError(403, "Boutique non validée ou suspendue.");
        const m = (await db.select().from(merchants).where(eq(merchants.userId, me.id)).limit(1))[0];
        const o = (await db.select().from(orders).where(eq(orders.id, n(p.orderId))).limit(1))[0];
        if (!m || !o || o.merchantId !== m.id) throw new ApiError(404, "Commande introuvable.");
        if (action === "merchantAccept") {
          if (o.status !== "payee") throw new ApiError(400, "Commande déjà traitée.");
          const prep = clamp(Math.round(n(p.prepMinutes)) || 10, 2, 90);
          await pushStatus(o, "acceptee", "Commande acceptée par le commerçant", { prepMinutes: prep });
          await notify(o.clientId, "ok", `${m.name} a accepté votre commande`, `Préparation estimée : ${prep} min.`, o.id);
        } else if (action === "merchantRefuse") {
          if (o.status !== "payee") throw new ApiError(400, "Seule une nouvelle commande peut être refusée.");
          await refundOrder(o, "refusee", s(p.reason) || "Indisponibilité signalée par le commerçant");
        } else if (action === "merchantPreparing") {
          if (o.status !== "acceptee") throw new ApiError(400, "Acceptez d'abord la commande.");
          await pushStatus(o, "preparation", "Préparation en cours");
          await notify(o.clientId, "info", "Préparation en cours 👨‍🍳", `${m.name} prépare votre commande ${o.code}.`, o.id);
        } else {
          if (o.status !== "preparation" && o.status !== "acceptee")
            throw new ApiError(400, "La commande doit être en préparation.");
          await pushStatus(o, "prete", "Commande prête");
          await notify(o.clientId, "info", "Commande prête ✔", "Recherche d'un livreur disponible dans votre secteur…", o.id);
          const cs = await db.select().from(couriers);
          const us = await db.select().from(users);
          const counts = await activeCounts();
          const assigned = await tryAssign(o, m, cs, new Map(us.map((u) => [u.id, u])), counts);
          if (!assigned)
            await notify(m.userId, "alerte", `Aucun livreur disponible pour ${o.code}`, "La commande sera attribuée dès qu'un livreur aura de la capacité dans le secteur.");
        }
        return Response.json({ ok: true });
      }

      case "productSave": {
        const me = await requireUser(["commercant"]);
        if (me.status !== "active") throw new ApiError(403, "Boutique non validée ou suspendue.");
        const m = (await db.select().from(merchants).where(eq(merchants.userId, me.id)).limit(1))[0];
        if (!m) throw new ApiError(404, "Boutique introuvable.");
        const name = s(p.name);
        const price = Math.round(n(p.price));
        if (name.length < 2) throw new ApiError(400, "Nom du produit trop court.");
        if (price < 10 || price > 500000) throw new ApiError(400, "Prix invalide (0,10 € à 5 000 €).");
        const values = {
          name,
          description: s(p.description),
          price,
          emoji: s(p.emoji) || "🛍️",
          stock: clamp(Math.round(n(p.stock)), 0, 999),
          available: b(p.available),
        };
        if (p.id) {
          const existing = (await db.select().from(products).where(eq(products.id, n(p.id))).limit(1))[0];
          if (!existing || existing.merchantId !== m.id) throw new ApiError(404, "Produit introuvable.");
          await db.update(products).set(values).where(eq(products.id, existing.id));
        } else {
          await db.insert(products).values({ ...values, merchantId: m.id, category: m.category, createdAt: now });
        }
        return Response.json({ ok: true });
      }

      case "productDelete": {
        const me = await requireUser(["commercant"]);
        const m = (await db.select().from(merchants).where(eq(merchants.userId, me.id)).limit(1))[0];
        const prod = (await db.select().from(products).where(eq(products.id, n(p.id))).limit(1))[0];
        if (!m || !prod || prod.merchantId !== m.id) throw new ApiError(404, "Produit introuvable.");
        await db.delete(products).where(eq(products.id, prod.id));
        return Response.json({ ok: true });
      }

      case "merchantUpdate": {
        const me = await requireUser(["commercant"]);
        if (me.status !== "active") throw new ApiError(403, "Boutique non validée ou suspendue.");
        const openHour = clamp(Math.round(n(p.openHour)), 0, 23);
        const closeHour = clamp(Math.round(n(p.closeHour)), 1, 23);
        if (closeHour <= openHour) throw new ApiError(400, "L'heure de fermeture doit suivre l'ouverture.");
        await db
          .update(merchants)
          .set({
            name: s(p.name) || undefined,
            description: s(p.description),
            emoji: s(p.emoji) || "🏪",
            cover: s(p.cover) || "ambre",
            openHour,
            closeHour,
            days: s(p.days) || "0123456",
            address: s(p.address),
          })
          .where(eq(merchants.userId, me.id));
        return Response.json({ ok: true });
      }

      /* ================= ADMIN ================= */
      case "adminDecide": {
        const me = await requireUser(["admin"]);
        const target = (await db.select().from(users).where(eq(users.id, n(p.userId))).limit(1))[0];
        if (!target) throw new ApiError(404, "Compte introuvable.");
        const decision = s(p.decision);
        const note = s(p.note);
        const map: Record<string, { status: UserStatus; label: string }> = {
          accept: { status: "active", label: "Dossier accepté ✅" },
          refuse: { status: "refused", label: "Dossier refusé" },
          docs: { status: "docs_required", label: "Documents complémentaires demandés" },
          suspend: { status: "suspended", label: "Compte suspendu" },
          disable: { status: "disabled", label: "Compte désactivé" },
          reactivate: { status: "active", label: "Compte réactivé" },
        };
        const d = map[decision];
        if (!d) throw new ApiError(400, "Décision inconnue.");
        if (decision === "docs" && !note) throw new ApiError(400, "Précisez les documents attendus.");
        await db.update(users).set({ status: d.status, statusNote: note }).where(eq(users.id, target.id));
        if (decision === "disable" || decision === "suspend")
          await db.update(couriers).set({ online: false }).where(eq(couriers.userId, target.id));
        await notify(target.id, decision === "accept" || decision === "reactivate" ? "ok" : "alerte", d.label, note || "Décision de l'administration Locho.");
        await log(me.id, d.label, `${target.role} #${target.id} · ${target.displayName || target.pseudo}`, note || "—");
        return Response.json({ ok: true });
      }

      case "adminConfig": {
        const me = await requireUser(["admin"]);
        const cfg = await getConfig();
        const incoming = (p.config ?? {}) as Partial<Config>;
        const next: Config = { ...cfg };
        const numKeys = ["minFee", "baseFee", "perKm", "urgentSupplement", "nightSupplement", "promoPercent", "courierSharePercent", "minPayout"] as const;
        for (const k of numKeys) if (incoming[k] !== undefined) next[k] = clamp(Math.round(n(incoming[k])), 0, 100000);
        next.openHour = clamp(Math.round(n(incoming.openHour ?? cfg.openHour)), 0, 23);
        next.closeHour = clamp(Math.round(n(incoming.closeHour ?? cfg.closeHour)), 1, 23);
        if (next.closeHour <= next.openHour) throw new ApiError(400, "Plage horaire invalide.");
        next.nightBefore = clamp(Math.round(n(incoming.nightBefore ?? cfg.nightBefore)), 0, 23);
        next.nightAfter = clamp(Math.round(n(incoming.nightAfter ?? cfg.nightAfter)), 0, 23);
        next.maxCapacity = clamp(Math.round(n(incoming.maxCapacity ?? cfg.maxCapacity)), 1, 20);
        next.maxRadiusKm = clamp(n(incoming.maxRadiusKm ?? cfg.maxRadiusKm), 1, 30);
        next.courierSharePercent = clamp(next.courierSharePercent, 0, 100);
        next.promoPercent = clamp(next.promoPercent, 0, 90);
        if (Array.isArray(incoming.zones)) next.zones = incoming.zones.map(s).filter(Boolean);
        if (Array.isArray(incoming.categories) && incoming.categories.length)
          next.categories = incoming.categories.map(s).filter(Boolean);
        if (incoming.categorySupplements && typeof incoming.categorySupplements === "object") {
          next.categorySupplements = {};
          for (const [k, v] of Object.entries(incoming.categorySupplements)) {
            const amt = Math.round(n(v));
            if (amt > 0) next.categorySupplements[k] = clamp(amt, 0, 5000);
          }
        }
        await saveConfig(next);
        await log(
          me.id,
          "Configuration modifiée",
          "Paramètres plateforme",
          `Service ${next.openHour}h–${next.closeHour}h · min ${euro(next.minFee)} · ${euro(next.perKm)}/km · répartition ${next.courierSharePercent}% livreur / ${100 - next.courierSharePercent}% plateforme`
        );
        return Response.json({ ok: true, config: next });
      }

      case "adminReassign": {
        const me = await requireUser(["admin"]);
        const o = (await db.select().from(orders).where(eq(orders.id, n(p.orderId))).limit(1))[0];
        if (!o) throw new ApiError(404, "Commande introuvable.");
        if (o.status !== "prete") throw new ApiError(400, "Réattribution possible uniquement avant récupération.");
        const c = (await db.select().from(couriers).where(eq(couriers.id, n(p.courierId))).limit(1))[0];
        if (!c || !c.online) throw new ApiError(400, "Livreur indisponible.");
        const counts = await activeCounts();
        if ((counts.get(c.id) ?? 0) >= c.capacity) throw new ApiError(400, "Ce livreur a atteint sa capacité choisie.");
        const shop = (await db.select().from(merchants).where(eq(merchants.id, o.merchantId)).limit(1))[0];
        const etaPickup = now + travelMs(roadKm(c.lat, c.lng, shop?.lat ?? c.lat, shop?.lng ?? c.lng), c.vehicle);
        await db
          .update(orders)
          .set({ courierId: c.id, assignedAt: now, etaPickup, routeFrom: { lat: c.lat, lng: c.lng } })
          .where(eq(orders.id, o.id));
        const cu = (await db.select().from(users).where(eq(users.id, c.userId)).limit(1))[0];
        await notify(o.clientId, "livreur", "Livreur réattribué", `${cu?.displayName ?? "Un livreur"} prend en charge votre commande ${o.code}.`, o.id);
        if (cu && !c.isBot) await notify(cu.id, "mission", "Mission réattribuée par l'administration", `Commande ${o.code} · ${o.address}`, o.id);
        await log(me.id, "Réattribution de commande", o.code, `Nouveau livreur : ${cu?.displayName ?? c.id}`);
        return Response.json({ ok: true });
      }

      case "adminCancel": {
        const me = await requireUser(["admin"]);
        const o = (await db.select().from(orders).where(eq(orders.id, n(p.orderId))).limit(1))[0];
        if (!o) throw new ApiError(404, "Commande introuvable.");
        if (["livree", "annulee", "refusee"].includes(o.status)) throw new ApiError(400, "Commande déjà clôturée.");
        await refundOrder(o, "annulee", s(p.reason) || "Annulation administrative");
        const shop = (await db.select().from(merchants).where(eq(merchants.id, o.merchantId)).limit(1))[0];
        if (shop) await notify(shop.userId, "alerte", `Commande ${o.code} annulée`, "Annulation par l'administration — remboursement client émis.");
        await log(me.id, "Annulation de commande", o.code, s(p.reason) || "Annulation administrative + remboursement intégral");
        return Response.json({ ok: true });
      }

      case "adminResolveDispute": {
        const me = await requireUser(["admin"]);
        const d = (await db.select().from(disputes).where(eq(disputes.id, n(p.disputeId))).limit(1))[0];
        if (!d) throw new ApiError(404, "Réclamation introuvable.");
        const status = s(p.status) === "rejete" ? "rejete" : "resolu";
        const note = s(p.note) || (status === "resolu" ? "Réclamation résolue." : "Réclamation rejetée.");
        const refund = clamp(Math.round(n(p.refundAmount)), 0, 1000000);
        await db.update(disputes).set({ status, decision: note, resolvedAt: now }).where(eq(disputes.id, d.id));
        if (refund > 0) {
          await db.insert(transactions).values({
            orderId: d.orderId,
            kind: "remboursement",
            amount: refund,
            partyRole: "client",
            partyId: d.clientId,
            label: `Remboursement litige (${d.reason})`,
            createdAt: now,
          });
        }
        await notify(d.clientId, status === "resolu" ? "ok" : "alerte", "Réponse à votre réclamation", `${d.reason} : ${note}${refund > 0 ? ` Remboursement de ${euro(refund)} émis.` : ""}`, d.orderId);
        await log(me.id, "Traitement de réclamation", `Litige #${d.id} (${d.reason})`, `${note}${refund ? ` · remboursement ${euro(refund)}` : ""}`);
        return Response.json({ ok: true });
      }

      case "adminPayout": {
        const me = await requireUser(["admin"]);
        const po = (await db.select().from(payouts).where(eq(payouts.id, n(p.payoutId))).limit(1))[0];
        if (!po || po.status !== "demande") throw new ApiError(400, "Demande déjà traitée.");
        const approve = b(p.approve);
        const c = (await db.select().from(couriers).where(eq(couriers.id, po.courierId)).limit(1))[0];
        await db.update(payouts).set({ status: approve ? "verse" : "refuse", processedAt: now }).where(eq(payouts.id, po.id));
        if (approve) {
          await db.insert(transactions).values({
            orderId: null,
            kind: "versement_livreur",
            amount: po.amount,
            partyRole: "livreur",
            partyId: po.courierId,
            label: `Versement livreur (PSP démo)`,
            createdAt: now,
          });
        }
        if (c) {
          const cu = (await db.select().from(users).where(eq(users.id, c.userId)).limit(1))[0];
          if (cu)
            await notify(cu.id, approve ? "gain" : "alerte", approve ? `Versement effectué · ${euro(po.amount)}` : "Demande de versement refusée", approve ? "Les fonds sont en route vers votre compte bancaire (PSP démo)." : "Contactez l'administration pour plus d'informations.");
        }
        await log(me.id, approve ? "Versement livreur validé" : "Versement livreur refusé", `Demande #${po.id}`, euro(po.amount));
        return Response.json({ ok: true });
      }

      case "adminSettleMerchant": {
        const me = await requireUser(["admin"]);
        const m = (await db.select().from(merchants).where(eq(merchants.id, n(p.merchantId))).limit(1))[0];
        if (!m) throw new ApiError(404, "Boutique introuvable.");
        const tx = await db
          .select()
          .from(transactions)
          .where(and(eq(transactions.partyRole, "commercant"), eq(transactions.partyId, m.id)));
        const owed =
          tx.filter((t) => t.kind === "produits_commercant").reduce((sum, t) => sum + t.amount, 0) -
          tx.filter((t) => t.kind === "reversement_commercant").reduce((sum, t) => sum + t.amount, 0);
        if (owed <= 0) throw new ApiError(400, "Aucune somme à reverser pour ce commerçant.");
        await db.insert(transactions).values({
          orderId: null,
          kind: "reversement_commercant",
          amount: owed,
          partyRole: "commercant",
          partyId: m.id,
          label: `Reversement produits — ${m.name} (PSP démo)`,
          createdAt: now,
        });
        await notify(m.userId, "gain", `Reversement effectué · ${euro(owed)}`, "Le montant de vos ventes vous a été reversé (PSP démo).");
        await log(me.id, "Reversement commerçant", m.name, euro(owed));
        return Response.json({ ok: true });
      }

      default:
        throw new ApiError(400, "Action inconnue.");
    }
  } catch (e) {
    if (e instanceof ApiError) return Response.json({ error: e.message }, { status: e.status });
    console.error("[action]", e);
    return Response.json({ error: "Erreur serveur inattendue." }, { status: 500 });
  }
}

void currentUser;