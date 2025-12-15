import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './_auth_helper.js';
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

    // Authenticate
    const session = getUserFromRequest(request);
    if (!session) return response.status(401).json({ error: 'Unauthorized' });

    try {
        if (request.method === 'GET') {
            const result = await db.select().from(userConfig).where(eq(userConfig.userId, session.id));
            if (result.length > 0) {
                return response.status(200).json(result[0]);
            }
            // Init default
            const def = {
                userId: session.id,
                weeklyTargetHours: 41,
                yearlyVacationDays: 25,
                initialOvertimeBalance: 0,
                vacationCarryover: 0
            };
            const inserted = await db.insert(userConfig).values(def).returning();
            return response.status(200).json(inserted[0]);
        }

        if (request.method === 'POST') {
            const body = request.body;
            if (!body) return response.status(400).json({ error: 'Missing body' });

            // We need to know the config ID to update, OR lookup by userId
            const existing = await db.select().from(userConfig).where(eq(userConfig.userId, session.id));

            if (existing.length > 0) {
                // Update
                const configId = existing[0].id;
                // Don't allow changing IDs
                const { id, userId, ...updates } = body;

                await db.update(userConfig)
                    .set(updates)
                    .where(eq(userConfig.id, configId));

                return response.status(200).json({ ...existing[0], ...updates });
            } else {
                // Create
                const def = {
                    userId: session.id,
                    weeklyTargetHours: body.weeklyTargetHours || 41,
                    yearlyVacationDays: body.yearlyVacationDays || 25,
                    initialOvertimeBalance: body.initialOvertimeBalance || 0,
                    vacationCarryover: body.vacationCarryover || 0
                };
                const inserted = await db.insert(userConfig).values(def).returning();
                return response.status(200).json(inserted[0]);
            }
        }

        return response.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
