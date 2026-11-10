import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

let cachedToken = null;
let tokenExpiresAt = 0;

function readEnv() {
  const env = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...vals] = trimmed.split('=');
        env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  return { ...process.env, ...env };
}

/**
 * Retrieve a valid Box access token.
 * Supports:
 * 1. Client Credentials Grant (BOX_CLIENT_ID + BOX_CLIENT_SECRET + optional BOX_ENTERPRISE_ID / BOX_USER_ID)
 * 2. Static Developer Token (BOX_DEV_TOKEN)
 */
export async function getBoxAccessToken() {
  const env = readEnv();

  // If Client Credentials are provided, automatically mint/refresh token via OAuth2
  if (env.BOX_CLIENT_ID && env.BOX_CLIENT_SECRET) {
    const now = Date.now();
    // Re-use cached token if it has at least 60s remaining
    if (cachedToken && tokenExpiresAt > now + 60_000) {
      return cachedToken;
    }

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.BOX_CLIENT_ID,
      client_secret: env.BOX_CLIENT_SECRET,
    });

    if (env.BOX_ENTERPRISE_ID) {
      params.append('box_subject_type', 'enterprise');
      params.append('box_subject_id', env.BOX_ENTERPRISE_ID);
    } else if (env.BOX_USER_ID) {
      params.append('box_subject_type', 'user');
      params.append('box_subject_id', env.BOX_USER_ID);
    } else {
      throw new Error('Box Client Credentials Grant requires BOX_ENTERPRISE_ID (from Admin Console > Account & Billing) or BOX_USER_ID in .env.');
    }

    try {
      const res = await fetch('https://api.box.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`Box OAuth2 token exchange failed (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (!data.access_token) {
        throw new Error('No access_token returned by Box OAuth2 endpoint');
      }

      cachedToken = data.access_token;
      tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      return cachedToken;
    } catch (err) {
      console.error('[Box Auth] CCG token generation failed:', err.message);
      if (env.BOX_DEV_TOKEN) {
        console.warn('[Box Auth] Falling back to BOX_DEV_TOKEN');
        return env.BOX_DEV_TOKEN;
      }
      throw err;
    }
  }

  // Fallback to developer token
  if (env.BOX_DEV_TOKEN) {
    return env.BOX_DEV_TOKEN;
  }

  return '';
}
