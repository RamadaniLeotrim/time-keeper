import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const url = import.meta.env.VITE_TURSO_DATABASE_URL;
const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN;

if (!url) {
    console.warn("VITE_TURSO_DATABASE_URL is not defined. DB operations will use in-memory fallback (non-persistent).");
}

const client = createClient({
    url: url || ':memory:',
    authToken: authToken,
});

export const db = drizzle(client, { schema });
