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
 * Data model: one JSON blob under one fixed key. There's no login/auth in
 * this app, so there's no per-user partitioning to do — treat the deployed
 * URL itself as the access control, same as every other route here. The
 * blob's shape mirrors whatever the frontend sends (see
 * src/services/cloudSync.ts): the app's own localStorage keys, verbatim, so
 * this endpoint doesn't need to know or care about their internal shape.
 */
const { Redis } = require('@upstash/redis');

const STATE_KEY = 'fire-dashboard:state:v1';

function getClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

module.exports = async (req, res) => {
  const client = getClient();
  if (!client) {
    // Not an error — just "nothing to do yet". Lets the UI show a clear
    // "cloud sync not set up" state instead of a scary failure.
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
