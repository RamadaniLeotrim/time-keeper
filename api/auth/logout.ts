import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearAuthCookie } from '../_auth_helper.js';

export default function handler(request: VercelRequest, response: VercelResponse) {
    // CORS
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');

    if (request.method === 'OPTIONS') return response.status(200).end();

    clearAuthCookie(response);
    return response.status(200).json({ success: true });
}
