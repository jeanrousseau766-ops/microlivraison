export type { MeData, AdminData, SafeUser, CourierRow, MerchantRow } from "@/lib/types";
import type { AdminData } from "@/lib/types";

export type AdminOrder = AdminData["orders"][number];
export type AdminDispute = AdminData["disputes"][number];
export type AdminCourier = AdminData["couriers"][number];
export type AdminMerchant = AdminData["merchants"][number];
