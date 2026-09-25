/**
 * Shared Upstash Redis client + key names, used by api/state.js (the manual
 * "Save/Load to cloud" backup) and api/monthly-income-snapshot.js (the
 * automatic monthly assumed-vs-actual capture). Split out so the cron
 * function can read the current plan inputs (STATE_KEY) in-process — no
 * extra HTTP hop or credential needed, since it's the same server-side
 * runtime with the same UPSTASH_REDIS_REST_URL/TOKEN already — while
 * writing its own captures to a SEPARATE key (SNAPSHOT_HISTORY_KEY),
 * deliberately isolated from STATE_KEY's manually-saved data. That
 * isolation is intentional: cloudSync.ts explicitly keeps cloud sync
 * user-triggered rather than automatic, specifically to avoid a background
 * write clobbering an in-progress edit — the monthly cron never writes into
 * STATE_KEY, so it can't collide with that.
 */
const { Redis } = require('@upstash/redis');

const STATE_KEY = 'fire-dashboard:state:v1';
const SNAPSHOT_HISTORY_KEY = 'fire-dashboard:trading-snapshots:v1';

function getClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

module.exports = { getClient, STATE_KEY, SNAPSHOT_HISTORY_KEY };
