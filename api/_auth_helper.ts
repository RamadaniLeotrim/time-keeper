import { serialize, parse } from 'cookie';
import jwt from 'jsonwebtoken';
import { VercelRequest, VercelResponse } from '@vercel/node';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod-without-env';

export interface UserSession {
    id: number;
    email: string;
    role: string;
}

export const setAuthCookie = (res: VercelResponse, user: UserSession) => {
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    const cookie = serialize('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    res.setHeader('Set-Cookie', cookie);
};

export const clearAuthCookie = (res: VercelResponse) => {
    const cookie = serialize('auth_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: -1,
    });
    res.setHeader('Set-Cookie', cookie);
};

export const getUserFromRequest = (req: VercelRequest): UserSession | null => {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;

    if (!token) return null;

    try {
        return jwt.verify(token, JWT_SECRET) as UserSession;
    } catch (e) {
        return null;
    }
};
