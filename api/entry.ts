import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_db.js';
import { timeEntries } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    // Add CORS headers
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PUT,DELETE');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    try {
        const { id } = request.query;

        if (!id || Array.isArray(id)) {
            return response.status(400).json({ error: 'Missing or invalid ID' });
        }

        const entryId = Number(id);

        if (request.method === 'PUT') {
            const body = request.body;
            if (!body) return response.status(400).json({ error: 'Missing body' });

            // Remove ID from body if present to avoid conflict
            const { id: _, ...updateData } = body;

            const result = await db.update(timeEntries)
                .set(updateData)
                .where(eq(timeEntries.id, entryId))
                .returning();

            return response.status(200).json(result[0]);
        }

        if (request.method === 'DELETE') {
            await db.delete(timeEntries).where(eq(timeEntries.id, entryId));
            return response.status(200).json({ success: true });
        }

        return response.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
