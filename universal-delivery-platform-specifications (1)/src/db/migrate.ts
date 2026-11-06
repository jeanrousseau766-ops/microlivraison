import { sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { SCHEMA_SQL } from "@/db/schema-sql";

/**
 * Installation autonome du schéma.
 *
 * Au tout premier lancement (base de données vierge), le site crée lui-même
 * toutes les tables : aucune commande manuelle à exécuter.
 *
 * Utilise le driver PostgreSQL brut (pool.query) pour les DDL — mécanisme
 * vérifié indépendamment — puis contrôle que les 12 tables existent réellement.
 */

const REQUIRED_TABLES = [
  "users",
  "sessions",
  "merchants",
  "products",
  "couriers",
  "orders",
  "notifications",
  "transactions",
  "payouts",
  "disputes",
  "admin_logs",
  "settings",
];

async function tableCount(): Promise<number> {
  const placeholders = REQUIRED_TABLES.map((_, i) => `$${i + 1}`).join(", ");
  const res = await pool.query(
    `select count(*)::int as count
     from information_schema.tables
     where table_schema = 'public' and table_name in (${placeholders})`,
    REQUIRED_TABLES
  );
  return Number(res.rows[0]?.count ?? 0);
}

async function apply(): Promise<void> {
  const current = await tableCount();
  if (current === REQUIRED_TABLES.length) return; // déjà installé

  const statements = SCHEMA_SQL.split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  let created = 0;
  let firstError = "";

  for (const statement of statements) {
    try {
      await pool.query(statement);
      created++;
    } catch (e) {
      const msg = (e as Error).message || "";
      if (!/already exists/i.test(msg) && !firstError) firstError = msg;
    }
  }

  const finalCount = await tableCount();
  if (finalCount === REQUIRED_TABLES.length) {
    console.log(
      `[installation] Schéma créé : ${finalCount}/${REQUIRED_TABLES.length} tables` +
        (firstError ? ` (remarques : ${firstError})` : "")
    );
    return;
  }

  // Vérification via Drizzle en second recours (même connexion applicative).
  const check = await db.execute(sql`select 1 as ok`);
  const ok = Array.isArray(check) || Boolean((check as { rows?: unknown[] })?.rows);
  console.error(
    `[installation] ÉCHEC : ${finalCount}/${REQUIRED_TABLES.length} tables — créées: ${created}, ` +
      `première erreur: ${firstError || "aucune"} (drizzle: ${ok ? "ok" : "ko"})`
  );
  throw new Error(
    `Installation du schéma incomplète (${finalCount}/${REQUIRED_TABLES.length} tables). ` +
      `Vérifiez DATABASE_URL. Détail : ${firstError || "inconnu"}`
  );
}

let schemaPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = apply().catch((e) => {
      schemaPromise = null; // retentable à la prochaine requête
      throw e;
    });
  }
  return schemaPromise;
}
