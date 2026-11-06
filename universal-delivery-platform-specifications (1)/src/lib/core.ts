import { eq, inArray, isNull, and } from "drizzle-orm";
import { db } from "@/db";
import {
  settings,
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
import type { OrderItem, TimelineEvent, OrderStatus } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { ensureSchema } from "@/db/migrate";
import {
  Config,
  computeFee,
  feeTotal,
  havKm,
  roadKm,
  ACTIVE_STATUSES,
} from "@/lib/util";

/* ---------- Configuration ---------- */

export const DEFAULT_CONFIG: Config = {
  openHour: 4,
  closeHour: 23,
  minFee: 390,
  baseFee: 250,
  perKm: 95,
  urgentSupplement: 200,
  nightSupplement: 150,
  nightBefore: 7,
  nightAfter: 21,
  categorySupplements: { "Colis & documents": 100 },
  promoPercent: 0,
  courierSharePercent: 70,
  maxCapacity: 8,
  maxRadiusKm: 10,
  minPayout: 1000,
  zones: ["Loches", "Beaulieu-lès-Loches", "Perrusson", "Saint-Jean-Saint-Germain"],
  categories: [
    "Restauration",
    "Boulangerie",
    "Courses",
    "Fleurs & cadeaux",
    "Mode",
    "Maison & fournitures",
    "Colis & documents",
  ],
  forbidden: [
    "Médicaments sur ordonnance",
    "Produits de santé réglementés",
    "Alcool (hors cadre légal vérifié)",
    "Tabac et produits assimilés",
    "Produits dangereux",
    "Armes et objets réglementés",
    "Produits dont le transport est interdit",
  ],
};

let cfgCache: { at: number; cfg: Config } | null = null;

export async function getConfig(force = false): Promise<Config> {
  if (!force && cfgCache && Date.now() - cfgCache.at < 1200) return cfgCache.cfg;
  const rows = await db.select().from(settings).where(eq(settings.key, "config")).limit(1);
  const stored = (rows[0]?.value ?? {}) as Partial<Config>;
  const cfg = { ...DEFAULT_CONFIG, ...stored };
  cfgCache = { at: Date.now(), cfg };
  return cfg;
}

export async function saveConfig(cfg: Config): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "config", value: cfg as unknown as Record<string, unknown> })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: cfg as unknown as Record<string, unknown> },
    });
  cfgCache = { at: Date.now(), cfg };
}

/* ---------- Notifications ---------- */

export async function notify(
  userId: number,
  kind: string,
  title: string,
  body = "",
  orderId?: number
): Promise<void> {
  await db
    .insert(notifications)
    .values({ userId, kind, title, body, orderId: orderId ?? null, createdAt: Date.now() });
}

/* ---------- Capacité & secteur ---------- */

export async function activeCounts(): Promise<Map<number, number>> {
  const rows = await db
    .select()
    .from(orders)
    .where(inArray(orders.status, ["prete", "recuperee", "en_livraison"] as OrderStatus[]));
  const map = new Map<number, number>();
  rows.forEach((o) => {
    if (o.courierId) map.set(o.courierId, (map.get(o.courierId) ?? 0) + 1);
  });
  return map;
}

export interface SectorStats {
  couriers: number;
  totalRemaining: number;
  pending: number;
  places: number;
  list: {
    id: number;
    name: string;
    vehicle: string;
    remaining: number;
    capacity: number;
    radiusKm: number;
    isBot: boolean;
    distanceKm: number;
  }[];
}

export async function sectorStats(lat: number, lng: number, radiusKm: number): Promise<SectorStats> {
  const rows = await db
    .select({ c: couriers, u: users })
    .from(couriers)
    .innerJoin(users, eq(couriers.userId, users.id))
    .where(eq(couriers.online, true));
  const counts = await activeCounts();
  const pendingRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.status, "prete"), isNull(orders.courierId)));
  const list: SectorStats["list"] = [];
  let totalRemaining = 0;
  for (const { c, u } of rows) {
    if (u.status !== "active") continue;
    const d = havKm(lat, lng, c.centerLat, c.centerLng);
    if (d > radiusKm + c.radiusKm) continue;
    const remaining = Math.max(0, c.capacity - (counts.get(c.id) ?? 0));
    totalRemaining += remaining;
    list.push({
      id: c.id,
      name: u.displayName || u.pseudo,
      vehicle: c.vehicle,
      remaining,
      capacity: c.capacity,
      radiusKm: c.radiusKm,
      isBot: c.isBot,
      distanceKm: d,
    });
  }
  const pending = pendingRows.length;
  return {
    couriers: list.length,
    totalRemaining,
    pending,
    places: Math.max(0, totalRemaining - pending),
    list: list.sort((a, b) => a.distanceKm - b.distanceKm),
  };
}

/* ---------- Seed ---------- */

let seedPromise: Promise<void> | null = null;

export function ensureSeed(): Promise<void> {
  if (!seedPromise) seedPromise = doSeed().catch((e) => {
    seedPromise = null;
    throw e;
  });
  return seedPromise;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function doSeed(): Promise<void> {
  await ensureSchema(); // installe le schéma si la base est vierge
  const flag = await db.select().from(settings).where(eq(settings.key, "seed_v1")).limit(1);
  if (flag.length) return;
  const now = Date.now();
  const demo = process.env.SEED_DEMO !== "0";
  const pw = hashPassword(process.env.DEMO_PASSWORD || "demo1234");
  const adminPseudo = (process.env.ADMIN_PSEUDO || "admin").toLowerCase();
  const adminPw = hashPassword(process.env.ADMIN_PASSWORD || "loches37");

  const mkUser = async (
    pseudo: string,
    role: "client" | "livreur" | "commercant" | "admin",
    displayName: string,
    extra: Partial<typeof users.$inferInsert> = {},
    password = pw
  ) => {
    const [u] = await db
      .insert(users)
      .values({ pseudo, passwordHash: password, role, displayName, createdAt: now, ...extra })
      .returning();
    return u;
  };

  const admin = await mkUser(adminPseudo, "admin", "Administration Locho", {}, adminPw);

  /* Mode production : aucun compte ni commerce de démonstration,
     uniquement le compte administrateur (jamais verrouillé hors ligne). */
  if (!demo) {
    await db.insert(adminLogs).values({
      adminId: admin.id,
      action: "Initialisation",
      target: "Plateforme",
      details: `Démarrage sans données de démonstration (SEED_DEMO=0) — compte administrateur « ${adminPseudo} » créé.`,
      createdAt: now,
    });
    await db.insert(settings).values({ key: "seed_v1", value: { done: true, demo: false, at: now } });
    return;
  }

  const camille = await mkUser("camille", "client", "Camille Roux", {
    phone: "06 12 34 56 78",
    address: "12 rue Picoys, 37600 Loches",
  });
  const julien = await mkUser("julien", "client", "Julien Moreau", {
    phone: "06 98 76 54 32",
    address: "3 place de la Marne, 37600 Loches",
  });
  await mkUser("theatre37", "client", "Théâtre en Touraine");

  const marcel = await mkUser("marcel", "commercant", "Marcel Dubois", {
    email: "contact@chezmarcel.fr",
    phone: "02 47 59 10 20",
  });
  const fournilU = await mkUser("fournil", "commercant", "Claire Fontaine");
  const epicerieU = await mkUser("epicerie", "commercant", "Nadia Benali");
  const fleursU = await mkUser("fleurs", "commercant", "Rose Lambert");
  const halleU = await mkUser("halle", "commercant", "Paul Gauthier");
  const modeU = await mkUser("remparts", "commercant", "Inès Caron");
  const beffroiU = await mkUser("beffroi", "commercant", "Hélène Roy", { status: "pending" });

  const mkMerchant = async (
    userId: number,
    name: string,
    category: string,
    emoji: string,
    cover: string,
    lat: number,
    lng: number,
    openHour: number,
    closeHour: number,
    description: string,
    address: string,
    autoManage: boolean,
    legalName: string
  ) => {
    const [m] = await db
      .insert(merchants)
      .values({
        userId,
        name,
        category,
        emoji,
        cover,
        lat,
        lng,
        openHour,
        closeHour,
        description,
        address,
        autoManage,
        legalName,
        siret: "8" + String(10000000 + Math.round(lat * lng * 1e7)).slice(0, 8) + " 00017",
        rating: 4.5 + Math.round((lat * 100) % 5) / 10,
        docs: [
          { name: "Extrait Kbis", fileName: "kbis-" + name.toLowerCase().replace(/[^a-z]/g, "") + ".pdf", expires: "2027-03-01" },
          { name: "Attestation d'assurance professionnelle", fileName: "assurance.pdf", expires: "2026-09-15" },
        ],
        createdAt: now,
      })
      .returning();
    return m;
  };

  const marcelM = await mkMerchant(marcel.id, "Chez Marcel", "Restauration", "🍲", "vermillon", 47.1294, 0.9948, 10, 22, "Bistrot de la Cité royale. Cuisine de saison, plats mijotés et desserts maison, préparés à la commande.", "8 rue du Donjon, Loches", false, "SARL Chez Marcel");
  const fournilM = await mkMerchant(fournilU.id, "Le Fournil des Remparts", "Boulangerie", "🥐", "ambre", 47.1281, 0.9985, 6, 19, "Pains au levain, viennoiseries pur beurre et pâtisseries fines. Fournées à 6h, 11h et 16h.", "2 place des Victoires, Loches", true, "EARL du Fournil");
  const epicerieM = await mkMerchant(epicerieU.id, "L'Épicerie du Donjon", "Courses", "🛒", "leaf", 47.1302, 0.9989, 4, 23, "Fruits & légumes du Lochois, produits laitiers fermiers et dépannage du quotidien. Service continu de 4h à 23h.", "14 rue Quintefol, Loches", true, "SCOP Épicéa");
  const fleursM = await mkMerchant(fleursU.id, "Fleurs d'Indre", "Fleurs & cadeaux", "💐", "rose", 47.1275, 0.9958, 9, 19, "Compositions florales de saison, plantes et douceurs. Bouquets montés le matin même.", "5 quai de l'Indre, Loches", true, "SAS Fleurs d'Indre");
  const halleM = await mkMerchant(halleU.id, "La Halle aux Cadeaux", "Maison & fournitures", "🎁", "river", 47.1288, 1.0001, 9, 20, "Papeterie artisanale, bougies, objets de la Cité et idées cadeaux livrées avec soin.", "11 grande Rue, Loches", true, "SAS La Halle");
  const modeM = await mkMerchant(modeU.id, "Remparts & Coton", "Mode", "🧣", "grape", 47.1268, 0.9979, 10, 19, "Accessoires en fibres naturelles, sélectionnés chez des créateurs français.", "3 rue des Remparts, Loches", true, "EURL Remparts & Coton");
  await mkMerchant(beffroiU.id, "Pâtisserie du Beffroi", "Boulangerie", "🧁", "ambre", 47.1291, 0.9967, 8, 19, "Pâtisseries fines au pied du beffroi (dossier en cours de validation).", "1 rue du Beffroi, Loches", false, "SAS Beffroi Gourmand");

  const mkProducts = async (
    m: { id: number },
    list: [string, string, number, string][]
  ) => {
    const inserted = [];
    for (const [name, description, price, emoji] of list) {
      const [p] = await db
        .insert(products)
        .values({
          merchantId: m.id,
          name,
          description,
          price,
          emoji,
          category: "Divers",
          stock: 8 + Math.round(havKm(price, price, 1, 1) * 3) + (price % 23),
          createdAt: now,
        })
        .returning();
      inserted.push(p);
    }
    return inserted;
  };

  const marcelP = await mkProducts(marcelM, [
    ["Bœuf bourguignon & purée", "Mijoté 7 heures, purée beurre fermier", 1390, "🥘"],
    ["Salade de chèvre chaud", "Chèvre de Touraine, miel du Lochois", 950, "🥗"],
    ["Croque truffé", "Pain de mie brioché, crème de truffe", 890, "🥪"],
    ["Tarte tatin maison", "Pommes caramélisées, pâte feuilletée", 550, "🥧"],
    ["Limonade artisanale", "Citron & verveine, 33 cl", 320, "🍋"],
    ["Café gourmand", "Trois mignardises du jour", 600, "☕"],
  ]);
  const fournilP = await mkProducts(fournilM, [
    ["Tradition au levain", "Farine Label Rouge, 250 g", 130, "🥖"],
    ["Croissant pur beurre", "Beurre AOP Charentes-Poitou", 120, "🥐"],
    ["Pain au chocolat", "Deux barres de chocolat noir", 130, "🍫"],
    ["Sandwich jambon-beurre", "Jambon blanc supérieur, beurre demi-sel", 450, "🥪"],
    ["Flan pâtissier", "Vanille Bourbon, part généreuse", 300, "🍮"],
    ["Éclair au café", "Crème pâtissière au café torréfié", 340, "🍩"],
  ]);
  const epicerieP = await mkProducts(epicerieM, [
    ["Panier de saison (3 kg)", "Fruits & légumes de producteurs locaux", 1290, "🧺"],
    ["Lait fermier 1 L", "Vaches pâturant en vallée de l'Indre", 160, "🥛"],
    ["Œufs plein air ×6", "Ferme des Granges, Beaulieu", 290, "🥚"],
    ["Comté 18 mois · 200 g", "Affiné en cave, fruité", 680, "🧀"],
    ["Jus de pomme pressé", "Vergers de Touraine, 75 cl", 350, "🍎"],
    ["Miel du Lochois · 250 g", "Récolte de printemps, toutes fleurs", 720, "🍯"],
    ["Pâtes artisanales · 500 g", "Semoule de blé dur, séchage lent", 310, "🍝"],
  ]);
  const fleursP = await mkProducts(fleursM, [
    ["Bouquet « Aube sur l'Indre »", "Roses, renoncules et eucalyptus", 2400, "💐"],
    ["Bouquet champêtre", "Fleurs de saison, tons pastel", 1850, "🌸"],
    ["Orchidée en pot", "Phalaenopsis blanc, cache-pot tuffeau", 2200, "🪴"],
    ["Chocolats pralinés", "Coffret 12 pièces, artisan chocolatier", 1250, "🍬"],
    ["Carte artisanale", "Illustrée à la main, Loches", 350, "💌"],
  ]);
  const halleP = await mkProducts(halleM, [
    ["Bougie « Pierre de tuffeau »", "Cire végétale, 40 h de combustion", 1490, "🕯️"],
    ["Carnet relié main", "Papier ivoire 120 g, 160 pages", 1100, "📓"],
    ["Stylo plume", "Laque bleu ardoise, plume acier", 1990, "🖋️"],
    ["Mug Cité royale", "Grès émaillé, illustration du donjon", 990, "☕"],
    ["Puzzle 1000 pièces", "Panorama de Loches au lever du jour", 1650, "🧩"],
  ]);
  const modeP = await mkProducts(modeM, [
    ["Écharpe laine mérinos", "Tissage français, coloris ardoise", 2900, "🧣"],
    ["Bonnet côtelé", "Laine mérinos, doublure polaire", 1500, "🧢"],
    ["Tote-bag Loches", "Coton bio, sérigraphie donjon", 1200, "👜"],
    ["Chaussettes fantaisie", "Motif dubes de Saint-Ours", 750, "🧦"],
  ]);

  /* Livreurs */
  const yanis = await mkUser("yanis", "livreur", "Yanis Bencherif", {
    email: "yanis.b@exemple.fr",
    phone: "06 44 55 66 77",
    address: "9 rue Alfred de Vigny, Loches",
    profile: {
      statut: "Micro-entrepreneur",
      siren: "912 445 786",
      birthDate: "1998-04-12",
      iban: "FR76 •••• •••• 4421",
      insuranceExp: "2027-01-31",
      docs: [
        { name: "Pièce d'identité", fileName: "cni-yanis.pdf" },
        { name: "Avis de situation SIRENE", fileName: "sirene-912445786.pdf" },
        { name: "Attestation d'assurance usage professionnel", fileName: "assurance-pro.pdf", expires: "2027-01-31" },
        { name: "Carte grise du scooter", fileName: "carte-grise.pdf" },
        { name: "Permis de conduire (BSR/AM)", fileName: "permis-am.pdf" },
      ],
    },
  });
  const sofia = await mkUser("sofia", "livreur", "Sofia Marchand");
  const karim = await mkUser("karim", "livreur", "Karim Diallo");
  const elodie = await mkUser("elodie", "livreur", "Élodie Petit");
  const hugo = await mkUser("hugo", "livreur", "Hugo Lemaire", {
    status: "pending",
    email: "hugo.lemaire@exemple.fr",
    phone: "07 11 22 33 44",
    address: "22 avenue de la République, Loches",
    profile: {
      statut: "Micro-entrepreneur",
      siren: "923 118 402",
      birthDate: "2001-09-03",
      iban: "FR76 •••• •••• 8830",
      docs: [
        { name: "Pièce d'identité", fileName: "cni-hugo.pdf" },
        { name: "Avis de situation SIRENE", fileName: "sirene-hugo.pdf" },
        { name: "Attestation d'assurance", fileName: "assurance-hugo.pdf", expires: "2026-12-15" },
      ],
    },
  });
  void hugo;

  const mkCourier = async (
    userId: number,
    vehicle: string,
    online: boolean,
    capacity: number,
    lat: number,
    lng: number,
    radiusKm: number,
    isBot: boolean
  ) => {
    const [c] = await db
      .insert(couriers)
      .values({
        userId,
        vehicle,
        online,
        capacity,
        centerLat: lat,
        centerLng: lng,
        radiusKm,
        lat,
        lng,
        isBot,
        lastSeen: now,
        createdAt: now,
      })
      .returning();
    return c;
  };

  const yanisC = await mkCourier(yanis.id, "scooter", false, 5, 47.1287, 0.9963, 5, false);
  const sofiaC = await mkCourier(sofia.id, "vae", true, 4, 47.1295, 0.997, 6, true);
  const karimC = await mkCourier(karim.id, "scooter", true, 5, 47.1275, 1.001, 5, true);
  await mkCourier(elodie.id, "velo", false, 3, 47.126, 0.994, 4, true);

  /* Historique de commandes livrées (14 jours) */
  const rand = rng(37);
  const allMerchants = [marcelM, fournilM, epicerieM, fleursM, halleM, modeM];
  const allProducts = [marcelP, fournilP, epicerieP, fleursP, halleP, modeP];
  const histCouriers = [yanisC, sofiaC, karimC];
  const cfg = DEFAULT_CONFIG;
  let codeN = 1000;
  let firstCamilleOrder = 0;

  for (let d = 14; d >= 1; d--) {
    const n = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const mi = Math.floor(rand() * allMerchants.length);
      const m = allMerchants[mi];
      const plist = allProducts[mi];
      const items: OrderItem[] = [];
      const nItems = 1 + Math.floor(rand() * 2);
      for (let j = 0; j < nItems; j++) {
        const p = plist[Math.floor(rand() * plist.length)];
        if (items.some((it) => it.productId === p.id)) continue;
        items.push({ productId: p.id, name: p.name, emoji: p.emoji, price: p.price, qty: 1 + Math.floor(rand() * 2) });
      }
      const itemsTotal = items.reduce((s, it) => s + it.price * it.qty, 0);
      const dropLat = 47.121 + rand() * 0.016;
      const dropLng = 0.989 + rand() * 0.024;
      const dist = roadKm(m.lat, m.lng, dropLat, dropLng);
      const fb = computeFee(cfg, dist, m.category, false, 12);
      const fee = feeTotal(fb);
      const c = histCouriers[Math.floor(rand() * histCouriers.length)];
      const client = rand() > 0.45 ? camille : julien;
      const t0 = now - d * 86400000 + Math.round((9 + rand() * 10) * 3600000);
      const deliveredAt = t0 + 26 * 60000;
      const timeline: TimelineEvent[] = (
        [
          ["creee", 0, "Commande effectuée"],
          ["payee", 8000, "Paiement confirmé"],
          ["acceptee", 95000, "Commande acceptée par le commerçant"],
          ["preparation", 160000, "Préparation en cours"],
          ["recuperee", 11 * 60000, "Commande récupérée par le livreur"],
          ["en_livraison", 12 * 60000, "Livraison en cours"],
          ["livree", 26 * 60000, "Commande livrée"],
        ] as [OrderStatus, number, string][]
      ).map(([status, off, label]) => ({ status, at: t0 + off, label }));
      const code = `LC-${codeN++}`;
      const [o] = await db
        .insert(orders)
        .values({
          code,
          clientId: client.id,
          merchantId: m.id,
          courierId: c.id,
          status: "livree",
          items,
          itemsTotal,
          deliveryFee: fee,
          feeBreakdown: fb,
          total: itemsTotal + fee,
          recipient: client.displayName,
          phone: client.phone || "06 00 00 00 00",
          address: client.address || "Loches centre",
          lat: dropLat,
          lng: dropLng,
          distanceKm: dist,
          prepMinutes: 10,
          createdAt: t0,
          statusAt: deliveredAt,
          assignedAt: t0 + 9 * 60000,
          pickedAt: t0 + 11 * 60000,
          deliveredAt,
          timeline,
          approachNotified: true,
        })
        .returning();
      if (client.id === camille.id && !firstCamilleOrder) firstCamilleOrder = o.id;
      await db.insert(transactions).values([
        { orderId: o.id, kind: "paiement", amount: itemsTotal + fee, partyRole: "client", partyId: client.id, label: `Paiement ${code} (PSP démo)`, createdAt: t0 },
        { orderId: o.id, kind: "produits_commercant", amount: itemsTotal, partyRole: "commercant", partyId: m.id, label: `Produits ${code} — prix commerçant`, createdAt: deliveredAt },
        { orderId: o.id, kind: "part_livreur", amount: fb.courierShare, partyRole: "livreur", partyId: c.id, label: `Part livreur ${code}`, createdAt: deliveredAt },
        { orderId: o.id, kind: "part_plateforme", amount: fb.platformShare, partyRole: "plateforme", partyId: null, label: `Part plateforme ${code}`, createdAt: deliveredAt },
      ]);
    }
  }

  if (firstCamilleOrder) {
    await db.insert(disputes).values({
      orderId: firstCamilleOrder,
      clientId: camille.id,
      reason: "Produit manquant",
      details: "Un article semble manquer dans le sac de livraison.",
      status: "ouvert",
      createdAt: now - 2 * 86400000,
    });
  }

  await db.insert(payouts).values({
    courierId: yanisC.id,
    amount: 1500,
    status: "demande",
    createdAt: now - 2 * 86400000,
  });

  await notify(camille.id, "info", "Bienvenue sur Locho 👋", "Votre compte est prêt. Explorez les commerces de la Cité royale !");
  await notify(yanis.id, "ok", "Dossier validé ✅", "Votre compte livreur est actif. Connectez-vous quand vous le souhaitez entre 4h et 23h.");
  await notify(hugo.id, "info", "Dossier reçu", "Votre candidature est en cours de vérification par l'administration.");
  await notify(beffroiU.id, "info", "Dossier reçu", "Votre demande d'inscription commerçant est en cours de vérification.");

  await db.insert(adminLogs).values({
    adminId: admin.id,
    action: "Initialisation",
    target: "Plateforme",
    details: "Configuration initiale : Loches (37), service 04h–23h, répartition 70 % livreur / 30 % plateforme.",
    createdAt: now,
  });

  await db.insert(settings).values({ key: "seed_v1", value: { done: true, at: now } });
}