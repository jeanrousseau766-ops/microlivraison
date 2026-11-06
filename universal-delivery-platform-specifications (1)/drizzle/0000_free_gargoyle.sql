CREATE TABLE "admin_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"action" text NOT NULL,
	"target" text DEFAULT '' NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "couriers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"vehicle" text DEFAULT 'velo' NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"capacity" integer DEFAULT 5 NOT NULL,
	"center_lat" double precision DEFAULT 47.1289 NOT NULL,
	"center_lng" double precision DEFAULT 0.9973 NOT NULL,
	"radius_km" double precision DEFAULT 5 NOT NULL,
	"lat" double precision DEFAULT 47.1289 NOT NULL,
	"lng" double precision DEFAULT 0.9973 NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"last_seen" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "couriers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"reason" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ouvert' NOT NULL,
	"decision" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"resolved_at" bigint
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"legal_name" text DEFAULT '' NOT NULL,
	"siret" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"emoji" text DEFAULT '🏪' NOT NULL,
	"cover" text DEFAULT 'ambre' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"open_hour" integer DEFAULT 8 NOT NULL,
	"close_hour" integer DEFAULT 20 NOT NULL,
	"days" text DEFAULT '0123456' NOT NULL,
	"auto_manage" boolean DEFAULT false NOT NULL,
	"rating" double precision DEFAULT 4.7 NOT NULL,
	"docs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kind" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"order_id" integer,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"client_id" integer NOT NULL,
	"merchant_id" integer NOT NULL,
	"courier_id" integer,
	"status" text DEFAULT 'creee' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"items_total" integer DEFAULT 0 NOT NULL,
	"delivery_fee" integer DEFAULT 0 NOT NULL,
	"fee_breakdown" jsonb DEFAULT 'null'::jsonb,
	"urgent" boolean DEFAULT false NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"recipient" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"address_extra" text DEFAULT '' NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"distance_km" double precision DEFAULT 1 NOT NULL,
	"prep_minutes" integer DEFAULT 10 NOT NULL,
	"created_at" bigint NOT NULL,
	"status_at" bigint NOT NULL,
	"assigned_at" bigint,
	"picked_at" bigint,
	"delivered_at" bigint,
	"eta_pickup" bigint,
	"eta_drop" bigint,
	"route_from" jsonb DEFAULT 'null'::jsonb,
	"approach_notified" boolean DEFAULT false NOT NULL,
	"timeline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cancel_reason" text DEFAULT '' NOT NULL,
	CONSTRAINT "orders_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"courier_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'demande' NOT NULL,
	"created_at" bigint NOT NULL,
	"processed_at" bigint
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"category" text DEFAULT 'Divers' NOT NULL,
	"emoji" text DEFAULT '🛍️' NOT NULL,
	"stock" integer DEFAULT 20 NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"party_role" text DEFAULT '' NOT NULL,
	"party_id" integer,
	"label" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"pseudo" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'client' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"status_note" text DEFAULT '' NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "users_pseudo_unique" UNIQUE("pseudo")
);
