import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_db.js';
import { userConfig } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    // Add CORS headers
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    try {
        if (request.method === 'GET') {
            const result = await db.select().from(userConfig).where(eq(userConfig.id, 1));
            if (result.length > 0) {
                return response.status(200).json(result[0]);
            }
            // Init default if not exists
            const def = {
                id: 1,
                weeklyTargetHours: 41,
                yearlyVacationDays: 25,
                initialOvertimeBalance: 0,
                vacationCarryover: 0
            };
            await db.insert(userConfig).values(def).onConflictDoNothing();
            return response.status(200).json(def);
        }

        if (request.method === 'POST') {
            const body = request.body;
            if (!body) return response.status(400).json({ error: 'Missing body' });

            // Ensure ID is 1
            const updated = { ...body, id: 1 };

            await db.insert(userConfig)
                .values(updated)
                .onConflictDoUpdate({ target: userConfig.id, set: updated });

            return response.status(200).json(updated);
        }

        return response.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
