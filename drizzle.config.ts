import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

// Fallback to local sqlite if TURSO URL is missing or 401
const isLocal = false;

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'turso',
    dbCredentials: {
        url: isLocal ? 'file:./local.db' : process.env.VITE_TURSO_DATABASE_URL!,
        authToken: isLocal ? undefined : process.env.VITE_TURSO_AUTH_TOKEN!,
    },
});
