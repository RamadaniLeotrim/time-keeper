import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_db.js';
import { users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { setAuthCookie } from '../_auth_helper.js';
import bcrypt from 'bcryptjs';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    // CORS
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') return response.status(200).end();
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

    const { email, password } = request.body;

    try {
        const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
        const user = result[0];

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return response.status(401).json({ error: 'Invalid credentials' });
        }

        setAuthCookie(response, { id: user.id, email: user.email, role: user.role });
        return response.status(200).json({ success: true, user: { id: user.id, email: user.email, name: user.name } });

    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
