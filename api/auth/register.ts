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

    const { email, password, name } = request.body;

    if (!email || !password || !name) {
        return response.status(400).json({ error: 'Missing fields' });
    }

    try {
        const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (existing.length > 0) {
            return response.status(409).json({ error: 'User already exists' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        // Return type of insert with returning() depending on driver support. Turso supports it.
        const newUser = await db.insert(users).values({
            email,
            password: hashedPassword,
            name,
            role: 'user'
        }).returning();

        const user = newUser[0];

        setAuthCookie(response, { id: user.id, email: user.email, role: user.role });
        return response.status(201).json({ success: true, user: { id: user.id, email: user.email, name: user.name } });

    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
