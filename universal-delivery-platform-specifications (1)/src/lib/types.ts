import type {
  Config,
  OrderItem,
  OrderStatus,
  TimelineEvent,
  FeeBreakdown,
  DocEntry,
  Role,
  UserStatus,
} from "@/lib/util";

export interface SafeUser {
  id: number;
  pseudo: string;
  role: Role;
  status: UserStatus;
  statusNote: string;
  displayName: string;
  email: string;
  phone: string;
  address: string;
  profile: Record<string, unknown>;
  createdAt: number;
}

export interface Notif {
  id: number;
  kind: string;
  title: string;
  body: string;
  orderId: number | null;
  read: boolean;
  createdAt: number;
}

export interface MeData {
  user: SafeUser | null;
  courier?: CourierRow | null;
  merchant?: MerchantRow | null;
  unread: number;
  notifications: Notif[];
}

export interface PublicMerchant {
  id: number;
  userId: number;
  name: string;
  legalName: string;
  category: string;
  description: string;
  emoji: string;
  cover: string;
  address: string;
  lat: number;
  lng: number;
  openHour: number;
  closeHour: number;
  days: string;
  rating: number;
  open: boolean;
}

export interface PublicProduct {
  id: number;
  merchantId: number;
  name: string;
  description: string;
  price: number;
  category: string;
  emoji: string;
  stock: number;
  available: boolean;
}

export interface PublicData {
  config: Config;
  serviceOpen: boolean;
  merchants: PublicMerchant[];
  products: PublicProduct[];
  stats: { merchantsOpen: number; merchantsTotal: number; couriersOnline: number; products: number };
}

export interface OrderBrief {
  id: number;
  code: string;
  status: OrderStatus;
  statusAt: number;
  createdAt: number;
  items: OrderItem[];
  itemsTotal: number;
  deliveryFee: number;
  total: number;
  urgent: boolean;
  address: string;
  recipient: string;
  distanceKm: number;
  prepMinutes: number;
  etaDrop: number | null;
  merchantId: number;
  timeline: TimelineEvent[];
  cancelReason: string;
  courierId: number | null;
}

export interface ClientOrder extends OrderBrief {
  merchantName: string;
  merchantEmoji: string;
  courier: { name: string; vehicle: string; lat: number; lng: number } | null;
}

export interface ClientData {
  orders: ClientOrder[];
}

export interface FullOrder extends OrderBrief {
  feeBreakdown: FeeBreakdown | null;
  lat: number;
  lng: number;
  phone: string;
  addressExtra: string;
  assignedAt: number | null;
  pickedAt: number | null;
  deliveredAt: number | null;
}

export interface DisputeRow {
  id: number;
  orderId: number;
  clientId: number;
  reason: string;
  details: string;
  status: string;
  decision: string;
  createdAt: number;
  resolvedAt: number | null;
}

export interface OrderDetailData {
  order: FullOrder;
  merchant: {
    id: number;
    name: string;
    emoji: string;
    cover: string;
    address: string;
    lat: number;
    lng: number;
    category: string;
  } | null;
  courier: { name: string; vehicle: string; lat: number | null; lng: number | null; phone: string } | null;
  dispute: DisputeRow | null;
  isOwner: boolean;
  canCancel: boolean;
}

export interface CourierRow {
  id: number;
  userId: number;
  vehicle: string;
  online: boolean;
  capacity: number;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  lat: number;
  lng: number;
  isBot: boolean;
}

export interface MerchantRow {
  id: number;
  userId: number;
  name: string;
  legalName: string;
  siret: string;
  category: string;
  description: string;
  emoji: string;
  cover: string;
  address: string;
  lat: number;
  lng: number;
  openHour: number;
  closeHour: number;
  days: string;
  autoManage: boolean;
  docs: DocEntry[];
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

export interface Mission extends OrderBrief {
  merchantName: string;
  merchantEmoji: string;
  merchantAddress: string;
  merchantLat: number;
  merchantLng: number;
  lat: number;
  lng: number;
  phone: string;
  addressExtra: string;
  gain: number;
  itemCount: number;
}

export interface PayoutRow {
  id: number;
  courierId: number;
  amount: number;
  status: string;
  createdAt: number;
  processedAt: number | null;
}

export interface CourierData {
  courier: CourierRow;
  config: {
    maxCapacity: number;
    maxRadiusKm: number;
    minPayout: number;
    openHour: number;
    closeHour: number;
    serviceOpen: boolean;
    courierSharePercent: number;
  };
  sector: SectorStats;
  missions: Mission[];
  history: Mission[];
  earnings: {
    today: number;
    week: number;
    month: number;
    total: number;
    deliveredCount: number;
    cancelledCount: number;
    fees: number;
    available: number;
    paidOut: number;
    pendingPayout: number;
    series: { day: string; amount: number }[];
  };
  payouts: PayoutRow[];
}

export interface MerchantOrder extends OrderBrief {
  clientName: string;
}

export interface MerchantData {
  merchant: MerchantRow & { open: boolean };
  products: PublicProduct[];
  orders: MerchantOrder[];
  stats: { today: number; week: number; owed: number; deliveredCount: number };
}

export interface AdminData {
  config: Config;
  kpis: {
    clients: number;
    couriers: number;
    couriersActive: number;
    merchants: number;
    ordersActive: number;
    ordersDone: number;
    ca: number;
    platformRevenue: number;
    owedCouriers: number;
    owedMerchants: number;
    disputesOpen: number;
    payoutsPending: number;
  };
  series: { day: string; amount: number; count: number }[];
  applications: (SafeUser & { courier: CourierRow | null; merchant: MerchantRow | null })[];
  clients: (SafeUser & { ordersCount: number })[];
  couriers: {
    id: number;
    userId: number;
    name: string;
    status: UserStatus;
    vehicle: string;
    online: boolean;
    isBot: boolean;
    capacity: number;
    active: number;
    remaining: number;
    centerLat: number;
    centerLng: number;
    radiusKm: number;
    lat: number;
    lng: number;
    delivered: number;
    earned: number;
    available: number;
  }[];
  merchants: {
    id: number;
    userId: number;
    name: string;
    emoji: string;
    category: string;
    status: UserStatus;
    open: boolean;
    siret: string;
    legalName: string;
    address: string;
    docs: DocEntry[];
    products: number;
    ordersCount: number;
    revenue: number;
    owed: number;
    lat: number;
    lng: number;
  }[];
  orders: (OrderBrief & { clientName: string; merchantName: string; courierName: string | null; blocked: boolean })[];
  disputes: (DisputeRow & { orderCode: string; orderTotal: number; clientName: string })[];
  payouts: (PayoutRow & { courierName: string })[];
  logs: { id: number; adminId: number; action: string; target: string; details: string; createdAt: number }[];
  onlineCouriersForReassign: { id: number; name: string; remaining: number; vehicle: string }[];
}