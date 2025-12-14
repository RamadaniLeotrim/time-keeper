import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_db.js';
import { timeEntries } from '../src/db/schema.js';
import { desc, eq } from 'drizzle-orm';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    // Add CORS headers
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
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
            const result = await db.select().from(timeEntries).orderBy(desc(timeEntries.date));
            return response.status(200).json(result);
        }

        if (request.method === 'POST') {
            const body = request.body;
            if (!body) {
                return response.status(400).json({ error: 'Missing body' });
            }

            // Check if array or single
            const data = Array.isArray(body) ? body : [body];

            if (data.length === 0) {
                return response.status(400).json({ error: 'Empty payload' });
            }

            const result = await db.insert(timeEntries).values(data).returning();

            // Return array if input was array, else single
            if (Array.isArray(body)) {
                return response.status(201).json(result);
            } else {
                return response.status(201).json(result[0]);
            }
        }

        if (request.method === 'DELETE') {
            const { id, all } = request.query;

            if (all === 'true') {
                await db.delete(timeEntries);
                return response.status(200).json({ success: true, message: 'All entries deleted' });
            }

            if (id && !Array.isArray(id)) {
                // Delete single
                await db.delete(timeEntries).where(eq(timeEntries.id, Number(id)));
                return response.status(200).json({ success: true });
            } else {
                return response.status(400).json({ error: 'Missing ID or all=true flag' });
            }
        }

        return response.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
