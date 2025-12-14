import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_db.js';
import { timeEntries } from '../src/db/schema.js';

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

    try {
        const current = await db.select().from(timeEntries);
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
            // Delete all and re-insert unique
            // Transactional safety would be better but LibSQL/Drizzle basic support:
            await db.delete(timeEntries);
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
