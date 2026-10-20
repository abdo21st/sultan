import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prefer this workstation's ignored local settings over any shared or remote .env values.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });
const databaseUrl = process.env["DIRECT_URL"] || process.env["DATABASE_URL"];

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    // Client generation is offline. Database commands must fail when no URL is configured.
    datasource: databaseUrl ? { url: databaseUrl } : undefined,
});
