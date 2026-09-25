/**
 * GET/POST /api/state — optional cloud backup for this app's data.
 *
 * Same shared-module pattern as api/calculate.js: one `module.exports =
 * async (req, res) => {...}` used two ways — server.js `require()`s it
 * directly for local dev, and Vercel auto-detects this file as its own
 * serverless function for production. No environment-specific branching is
 * needed (unlike api/cas/parse.py, which genuinely needed two separate
 * implementations because Python subprocess spawning only works locally) —
 * @upstash/redis is a plain HTTPS REST client under the hood, so the exact
 * same code path runs identically in both places.
 *
 * Storage: Upstash Redis, free tier (256MB data / 500K commands per month —
 * far more than one person's app state needs). Configure via the Vercel
 * Marketplace (`vercel install upstash`, or the dashboard) or directly at
 * upstash.com; either way you end up with two values,
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. Add them to
 * `.env`/`.env.local` for local dev (server.js loads them via dotenv, see
 * below) and to the Vercel project's Environment Variables for production.
 * Until both are set, every request responds 200 with
 * `{ configured: false }` rather than erroring, so the app keeps working
 * exactly as it always has (localStorage-only) with nothing broken.
 *
 * Auth: this used to trust "the deployed URL itself" as access control —
 * it wasn't. A GET here returns this app's ENTIRE financial plan (wealth,
 * retirement corpus, full asset allocation, real-estate plans, every stored
 * snapshot) and a *.vercel.app URL is not a secret — it's guessable/
 * enumerable, and a plain unauthenticated GET (no browser, no session)
 * could read all of it. Now gated behind a dedicated bearer token
 * (SYNC_TOKEN), same "shared secret, timing-safe compare" shape as
 * api/trading-income.js's outbound call and oi-analyzer's ADMIN_SECRET —
 * checked on BOTH GET and POST. Unlike the "actual P&L" integrations, this
 * fails CLOSED, not open: if SYNC_TOKEN isn't set server-side, cloud sync
 * reports `{ configured: false }` (disabled) rather than staying reachable
 * without a token, because "silently open" is exactly the bug being fixed
 * here. The frontend sends this token via VITE_SYNC_TOKEN (see
 * src/services/cloudSync.ts) — baked into the client bundle at build time,
 * same as oi-analyzer's VITE_ADMIN_SECRET. That stops opportunistic/
 * scripted requests hitting this URL directly (the actual exposure found),
 * though — same caveat as any client-embedded secret — it doesn't
 * withstand someone who deliberately reads the shipped JS bundle. Good
 * enough for "not casually scrapeable," not a claim of stronger security.
 *
 * Data model: one JSON blob under one fixed key. There's still no
 * per-user login in this app — SYNC_TOKEN is a single shared secret, not a
 * user account — the blob's shape mirrors whatever the frontend sends (see
 * src/services/cloudSync.ts): the app's own localStorage keys, verbatim, so
 * this endpoint doesn't need to know or care about their internal shape.
 */
const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

const STATE_KEY = 'fire-dashboard:state:v1';

function getClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function isAuthorized(req) {
  const expected = process.env.SYNC_TOKEN;
  if (!expected) return false; // fail closed — unset means cloud sync is disabled, not open
  const header = req.headers && req.headers.authorization;
  const provided = header && header.toLowerCase().startsWith('bearer ') ? header.slice(7) : '';
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) {
    // timingSafeEqual throws on length mismatch — compare against itself so
    // the response time doesn't leak the real token's length either.
    crypto.timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

module.exports = async (req, res) => {
  const client = getClient();
  if (!client || !isAuthorized(req)) {
    // Not (necessarily) an error — matches the existing "nothing to do
    // yet" convention. Also the response for "token missing/wrong", so a
    // scanner probing this URL learns nothing more than "not configured".
    if (req.method === 'GET') return res.status(200).json({ configured: false });
    return res.status(200).json({ configured: false, saved: false });
  }

  try {
    if (req.method === 'GET') {
      const state = await client.get(STATE_KEY);
      return res.status(200).json({ configured: true, state: state ?? null });
    }

    if (req.method === 'POST') {
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({ error: 'Request body must be a JSON object.' });
      }
      const record = { ...body, updatedAt: new Date().toISOString() };
      await client.set(STATE_KEY, record);
      return res.status(200).json({ configured: true, saved: true, updatedAt: record.updatedAt });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Cloud sync request failed.' });
  }
};
