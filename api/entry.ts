import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_db.js';
import { timeEntries } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getUserFromRequest } from './_auth_helper.js';

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

    // Authenticate
    const session = getUserFromRequest(request);
    if (!session) return response.status(401).json({ error: 'Unauthorized' });

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
            const { id: _, userId, ...updateData } = body;

            // Ensure we only update if it belongs to user
            const result = await db.update(timeEntries)
                .set(updateData)
                .where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, session.id)))
                .returning();

            if (result.length === 0) return response.status(404).json({ error: 'Not found or permission denied' });

            return response.status(200).json(result[0]);
        }

        if (request.method === 'DELETE') {
            const result = await db.delete(timeEntries)
                .where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, session.id)))
                .returning();

            if (result.length === 0) return response.status(404).json({ error: 'Not found or permission denied' });

            return response.status(200).json({ success: true });
        }

        return response.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
