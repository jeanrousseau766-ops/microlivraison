import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  jsonb,
  doublePrecision,
} from "drizzle-orm/pg-core";

/* ---------- Types partagés (JSON) ---------- */

export type Role = "client" | "livreur" | "commercant" | "admin";
export type UserStatus =
  | "active"
  | "pending"
  | "docs_required"
  | "refused"
  | "suspended"
  | "disabled";

export type OrderStatus =
  | "creee"
  | "payee"
  | "acceptee"
  | "preparation"
  | "prete"
  | "recuperee"
  | "en_livraison"
  | "livree"
  | "annulee"
  | "refusee";

export interface OrderItem {
  productId: number;
  name: string;
  emoji: string;
  price: number; // centimes
  qty: number;
}

export interface FeeLine {
  label: string;
  amount: number; // centimes
}

export interface FeeBreakdown {
  base: number;
  distance: number;
  urgent: number;
  horaire: number;
  categorie: number;
  promo: number; // négatif
  lines: FeeLine[];
  courierShare: number;
  platformShare: number;
}

export interface TimelineEvent {
  status: OrderStatus;
  at: number;
  label: string;
}

export interface DocEntry {
  name: string;
  fileName: string;
  expires?: string;
}

/* ---------- Tables ---------- */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  pseudo: text("pseudo").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<Role>().notNull().default("client"),
  status: text("status").$type<UserStatus>().notNull().default("active"),
  statusNote: text("status_note").notNull().default(""),
  displayName: text("display_name").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  profile: jsonb("profile").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
});

export const merchants = pgTable("merchants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  legalName: text("legal_name").notNull().default(""),
  siret: text("siret").notNull().default(""),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  emoji: text("emoji").notNull().default("🏪"),
  cover: text("cover").notNull().default("ambre"),
  address: text("address").notNull().default(""),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  openHour: integer("open_hour").notNull().default(8),
  closeHour: integer("close_hour").notNull().default(20),
  days: text("days").notNull().default("0123456"),
  autoManage: boolean("auto_manage").notNull().default(false),
  rating: doublePrecision("rating").notNull().default(4.7),
  docs: jsonb("docs").$type<DocEntry[]>().notNull().default([]),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: integer("price").notNull(), // centimes, fixé par le commerçant
  category: stringRef(),
  emoji: text("emoji").notNull().default("🛍️"),
  stock: integer("stock").notNull().default(20),
  available: boolean("available").notNull().default(true),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

function stringRef() {
  return text("category").notNull().default("Divers");
}

export const couriers = pgTable("couriers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  vehicle: text("vehicle").notNull().default("velo"),
  online: boolean("online").notNull().default(false),
  capacity: integer("capacity").notNull().default(5),
  centerLat: doublePrecision("center_lat").notNull().default(47.1289),
  centerLng: doublePrecision("center_lng").notNull().default(0.9973),
  radiusKm: doublePrecision("radius_km").notNull().default(5),
  lat: doublePrecision("lat").notNull().default(47.1289),
  lng: doublePrecision("lng").notNull().default(0.9973),
  isBot: boolean("is_bot").notNull().default(false),
  lastSeen: bigint("last_seen", { mode: "number" }).notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  clientId: integer("client_id").notNull(),
  merchantId: integer("merchant_id").notNull(),
  courierId: integer("courier_id"),
  status: text("status").$type<OrderStatus>().notNull().default("creee"),
  items: jsonb("items").$type<OrderItem[]>().notNull().default([]),
  itemsTotal: integer("items_total").notNull().default(0),
  deliveryFee: integer("delivery_fee").notNull().default(0),
  feeBreakdown: jsonb("fee_breakdown").$type<FeeBreakdown | null>().default(null),
  urgent: boolean("urgent").notNull().default(false),
  total: integer("total").notNull().default(0),
  recipient: text("recipient").notNull().default(""),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  addressExtra: text("address_extra").notNull().default(""),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  distanceKm: doublePrecision("distance_km").notNull().default(1),
  prepMinutes: integer("prep_minutes").notNull().default(10),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  statusAt: bigint("status_at", { mode: "number" }).notNull(),
  assignedAt: bigint("assigned_at", { mode: "number" }),
  pickedAt: bigint("picked_at", { mode: "number" }),
  deliveredAt: bigint("delivered_at", { mode: "number" }),
  etaPickup: bigint("eta_pickup", { mode: "number" }),
  etaDrop: bigint("eta_drop", { mode: "number" }),
  routeFrom: jsonb("route_from").$type<{ lat: number; lng: number } | null>().default(null),
  approachNotified: boolean("approach_notified").notNull().default(false),
  timeline: jsonb("timeline").$type<TimelineEvent[]>().notNull().default([]),
  cancelReason: text("cancel_reason").notNull().default(""),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  kind: text("kind").notNull().default("info"),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  orderId: integer("order_id"),
  read: boolean("read").notNull().default(false),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id"),
  kind: text("kind").notNull(), // paiement | produits_commercant | part_livreur | part_plateforme | remboursement | versement_livreur | reversement_commercant
  amount: integer("amount").notNull(), // centimes
  partyRole: text("party_role").notNull().default(""),
  partyId: integer("party_id"),
  label: text("label").notNull().default(""),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const payouts = pgTable("payouts", {
  id: serial("id").primaryKey(),
  courierId: integer("courier_id").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("demande"), // demande | verse | refuse
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  processedAt: bigint("processed_at", { mode: "number" }),
});

export const disputes = pgTable("disputes", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  clientId: integer("client_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details").notNull().default(""),
  status: text("status").notNull().default("ouvert"), // ouvert | en_cours | resolu | rejete
  decision: text("decision").notNull().default(""),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  resolvedAt: bigint("resolved_at", { mode: "number" }),
});

export const adminLogs = pgTable("admin_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull().default(""),
  details: text("details").notNull().default(""),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
});