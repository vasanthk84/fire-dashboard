/**
 * GET /api/monthly-income-snapshot — automatic monthly record of assumed
 * vs. actual options income, PLUS the read endpoint the UI uses to show
 * that history.
 *
 * Two very different callers hit this one GET route:
 *
 *  1. Vercel Cron (see vercel.json's `crons` entry, scheduled monthly).
 *     Vercel signs cron-triggered requests with `Authorization: Bearer
 *     <CRON_SECRET>` when a CRON_SECRET env var is set — that's how this
 *     tells a real cron firing apart from anyone else hitting this public
 *     URL. Only a request carrying the correct CRON_SECRET triggers a
 *     capture (idempotent — firing twice in the same month is a no-op).
 *  2. The browser (fire-dashboard's own UI, reading the stored history to
 *     display it). No token needed for this — same "aggregate P&L only,
 *     not sensitive" precedent as api/trading-income.js. It never carries
 *     CRON_SECRET, so it only ever reads, never writes.
 *
 * Storage: an isolated Redis key (SNAPSHOT_HISTORY_KEY, from ./_lib/redis.js)
 * — deliberately SEPARATE from STATE_KEY, the key the manual "Save/Load to
 * cloud" feature (cloudSync.ts) reads and writes. That isolation is the
 * whole point: cloudSync.ts is explicit and user-triggered specifically to
 * avoid a background write clobbering an in-progress edit (see its own
 * comment), and this cron job is exactly the kind of background write that
 * comment warns about — so it never touches STATE_KEY at all. It only
 * READS STATE_KEY (in-process, via the same already-authorized Redis
 * client — no extra HTTP hop or credential needed) to see the CURRENT
 * optionsPortfolioValue/optionsYieldPct assumption at capture time, exactly
 * the same values OptionsYieldHint.tsx would read from `inputs` if you had
 * the app open that day.
 *
 * If UPSTASH_REDIS_REST_URL/TOKEN aren't configured, or there's no saved
 * plan yet, or trade-analytics isn't reachable, this just reports
 * `{ configured: false }` / an empty history — same "not broken, just not
 * set up yet" convention as every other route here.
 */
const crypto = require('crypto');
const { getClient, STATE_KEY, SNAPSHOT_HISTORY_KEY } = require('./_lib/redis');
const { fetchTradingIncomeSummary } = require('./_lib/tradingIncome');

function isFromVercelCron(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers && req.headers.authorization;
  const provided = header && header.toLowerCase().startsWith('bearer ') ? header.slice(7) : '';
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) {
    crypto.timingSafeEqual(expectedBuf, expectedBuf); // keep timing constant either way
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/** Reads the current plan's options-income assumption from STATE_KEY and
 *  this month's actual from trade-analytics, and appends one entry to
 *  SNAPSHOT_HISTORY_KEY — unless this month already has an entry, or
 *  there's not yet enough data to make one meaningful. Never throws: any
 *  failure here just means no entry gets added this run, which the next
 *  scheduled run will simply retry. */
async function captureSnapshot(client) {
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const existing = (await client.get(SNAPSHOT_HISTORY_KEY)) || [];
  if (existing.some((entry) => entry.month === monthKey)) {
    return; // already captured this month
  }

  const [state, income] = await Promise.all([client.get(STATE_KEY), fetchTradingIncomeSummary()]);
  const inputs = state && state['fire-planner-plan-v1'] && state['fire-planner-plan-v1'].inputs;
  if (!inputs || !income.configured || income.error || !Array.isArray(income.monthlyFO) || income.monthlyFO.length === 0) {
    return; // no saved plan yet, or trade-analytics not reachable/configured — nothing to capture
  }

  const assumedPortfolioLakhs = inputs.optionsPortfolioValue;
  const portfolioRupees = assumedPortfolioLakhs * 100000;
  if (!(portfolioRupees > 0)) return;

  // Same method OptionsYieldHint.tsx uses: one % per month, averaged, ×12 —
  // the only place a percentage is computed directly from P&L.
  const monthlyPct = income.monthlyFO.map((m) => (m.pnl / portfolioRupees) * 100);
  const avgMonthlyPct = monthlyPct.reduce((a, v) => a + v, 0) / monthlyPct.length;
  const actualAnnualizedPct = avgMonthlyPct * 12;
  const totalPnlSinceStart = income.monthlyFO.reduce((a, m) => a + m.pnl, 0);
  const assumedYieldPct = (inputs.optionsYieldPct || 0) * 100;

  const entry = {
    month: monthKey,
    capturedAt: now.toISOString(),
    assumedPortfolioLakhs,
    assumedYieldPct: Number(assumedYieldPct.toFixed(2)),
    actualAnnualizedPct: Number(actualAnnualizedPct.toFixed(2)),
    totalPnlSinceStart: Math.round(totalPnlSinceStart),
    monthsOfData: income.monthlyFO.length,
    diverges: Math.abs(actualAnnualizedPct - assumedYieldPct) >= 5
  };

  await client.set(SNAPSHOT_HISTORY_KEY, [...existing, entry]);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = getClient();
  if (!client) {
    return res.status(200).json({ configured: false, history: [] });
  }

  try {
    if (isFromVercelCron(req)) {
      await captureSnapshot(client);
    }

    const history = (await client.get(SNAPSHOT_HISTORY_KEY)) || [];
    return res.status(200).json({ configured: true, history });
  } catch (error) {
    return res.status(200).json({ configured: true, history: [], error: error.message || 'Snapshot request failed.' });
  }
};
