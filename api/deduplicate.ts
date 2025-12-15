import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_db.js';
import { timeEntries } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { getUserFromRequest } from './_auth_helper.js';

type TimeEntry = typeof timeEntries.$inferSelect;

export default async function handler(request: VercelRequest, response: VercelResponse) {
    // Add CORS headers
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    // Authenticate
    const session = getUserFromRequest(request);
    if (!session) return response.status(401).json({ error: 'Unauthorized' });

    try {
        const current = await db.select().from(timeEntries).where(eq(timeEntries.userId, session.id));
        const unique = new Map<string, typeof timeEntries.$inferSelect>();
        let duplicatesRemoved = 0;

        current.forEach(e => {
            const key = `${e.date}-${e.type}-${e.startTime}-${e.endTime}-${e.notes}`;
            if (!unique.has(key)) {
                unique.set(key, e);
            } else {
                duplicatesRemoved++;
            }
        });

        if (duplicatesRemoved > 0) {
            // Delete all for THIS user and re-insert unique
            await db.delete(timeEntries).where(eq(timeEntries.userId, session.id));
            if (unique.size > 0) {
                await db.insert(timeEntries).values(Array.from(unique.values()));
            }
        }

        return response.status(200).json({ duplicatesRemoved });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
