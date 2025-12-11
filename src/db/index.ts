// import { createClient } from '@libsql/client';
// import { drizzle } from 'drizzle-orm/libsql';
// import * as schema from './schema';

// const url = import.meta.env.VITE_TURSO_DATABASE_URL;
// const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN;

// Temporary safe mode: Export dummy db to prevent browser crash
// Real DB init will be restored once we fix Turso connection.
export const db = {} as any;

/*
const client = createClient({
    url: ':memory:',
    authToken: undefined
});

export const db = drizzle(client, { schema });
*/
