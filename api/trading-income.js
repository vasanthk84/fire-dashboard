/**
 * GET /api/trading-income — actual realized options/F&O P&L, read from the
 * trade-analytics app (D:\Zerodha_Reports, deployed as the "zerodha-report"
 * Vercel project), so the "Options income" card can show the REAL realized
 * yield next to the assumed `optionsYieldPct` you type in by hand.
 *
 * Same shared-module pattern as api/state.js: one `module.exports = async
 * (req, res) => {...}` used two ways — server.js `require()`s it directly
 * for local dev, and Vercel auto-detects this file as its own serverless
 * function for production.
 *
 * This is a SERVER-SIDE call only — the Bearer token never reaches the
 * browser. Configure via:
 *   TA_API_TOKEN        — same shared secret set on the zerodha-report
 *                          project (see Zerodha_Reports/lib/auth.js)
 *   TRADE_ANALYTICS_URL — optional override; defaults to the production
 *                          trade-analytics deployment
 * Add both to `.env`/`.env.local` for local dev (server.js loads them via
 * dotenv) and to this Vercel project's Environment Variables for production.
 * Until TA_API_TOKEN is set, every request responds 200 with
 * `{ configured: false }` — same "not broken, just not set up yet" pattern
 * as api/state.js — so the UI simply hides the hint until both apps agree
 * on the token.
 *
 * The actual upstream call lives in ./_lib/tradingIncome.js, shared with
 * api/monthly-income-snapshot.js's automatic capture — this file is now
 * just that shared logic plus the GET/method handling this route needs.
 */
const { fetchTradingIncomeSummary } = require('./_lib/tradingIncome');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const summary = await fetchTradingIncomeSummary();
  return res.status(200).json(summary);
};
