import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from '../_auth_helper.js';
import { db } from '../_db.js';
import { users, timeEntries, userConfig } from '../../src/db/schema.js';
import { eq, ne } from 'drizzle-orm';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') return response.status(200).end();

    // 1. Auth & Admin Check
    const session = getUserFromRequest(request);
    if (!session) {
        return response.status(401).json({ error: 'Not authenticated' });
    }

    // Verify role in DB (don't trust token alone if role changed recently, but token usually ok for stateless)
    // Actually, getting fresh role from DB is safer for Admin actions.
    const currentUser = await db.select({ role: users.role }).from(users).where(eq(users.id, session.id)).get();

    if (!currentUser || currentUser.role !== 'admin') {
        return response.status(403).json({ error: 'Forbidden: Admins only' });
    }

    try {
        if (request.method === 'GET') {
            // LIST ALL USERS
            const allUsers = await db.select({
                id: users.id,
                email: users.email,
                name: users.name,
                role: users.role,
                createdAt: users.createdAt
            }).from(users).all();

            return response.status(200).json(allUsers);
        }

        if (request.method === 'PUT') {
            // UPDATE ROLE
            const { userId, role } = request.body;
            if (!userId || !role || !['admin', 'user'].includes(role)) {
                return response.status(400).json({ error: 'Invalid data' });
            }

            // Prevent removing own admin status (safety net)
            if (userId === session.id && role !== 'admin') {
                return response.status(400).json({ error: 'Cannot demote yourself' });
            }

            await db.update(users).set({ role }).where(eq(users.id, userId));
            return response.status(200).json({ success: true });
        }

        if (request.method === 'DELETE') {
            // DELETE USER
            // DANGER ZONE
            const { userId } = request.query;
            const targetId = Number(userId);

            if (!targetId) return response.status(400).json({ error: 'Missing userId' });
            if (targetId === session.id) return response.status(400).json({ error: 'Cannot delete yourself' });

            // Manual Cascade Delete (since we didn't set ON DELETE CASCADE in schema/DB triggers might not be there)
            await db.delete(timeEntries).where(eq(timeEntries.userId, targetId));
            await db.delete(userConfig).where(eq(userConfig.userId, targetId));
            await db.delete(users).where(eq(users.id, targetId));

            return response.status(200).json({ success: true });
        }

        return response.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        console.error("Admin API Error", e);
        return response.status(500).json({ error: 'Server error' });
    }
}
