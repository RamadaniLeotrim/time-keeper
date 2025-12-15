import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from '../_auth_helper.js';
import { db } from '../_db.js';
import { users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') return response.status(200).end();

    const session = getUserFromRequest(request);
    if (!session) {
        return response.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const result = await db.select({ id: users.id, email: users.email, name: users.name, role: users.role })
            .from(users)
            .where(eq(users.id, session.id))
            .limit(1);

        if (result.length === 0) return response.status(401).json({ error: 'User not found' });

        return response.status(200).json({ user: result[0] });
    } catch (e) {
        return response.status(500).json({ error: 'Server error' });
    }
}
