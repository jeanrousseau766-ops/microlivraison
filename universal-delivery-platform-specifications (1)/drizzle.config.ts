import { defineConfig } from "drizzle-kit";

/**
 * La base cible est lue dans la variable d'environnement DATABASE_URL.
 * - En local : .env (postgresql://…@127.0.0.1:5432/app_db)
 * - En production : DATABASE_URL="postgresql://…" npx drizzle-kit push
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  },
});
