import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(request: VercelRequest, response: VercelResponse) {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    response.json({
        url_defined: !!url,
        url_prefix: url ? url.substring(0, 8) : 'N/A',
        token_defined: !!token,
        token_prefix: token ? token.substring(0, 5) : 'N/A',
        node_env: process.env.NODE_ENV,
        message: "If url_defined or token_defined is false, the keys are missing in Vercel."
    });
}
