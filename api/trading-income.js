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
 * Deliberately proxies only the aggregate /api/pnl-summary endpoint, never
 * /api/trades — this app has no business seeing per-trade rows, only the
 * net P&L totals needed to compare against the assumed yield.
 */
const DEFAULT_BASE_URL = 'https://zerodha-report.vercel.app';

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.TA_API_TOKEN;
  if (!token) {
    // Not an error — mirrors api/state.js's "nothing to do yet" convention.
    return res.status(200).json({ configured: false });
  }

  const baseUrl = process.env.TRADE_ANALYTICS_URL || DEFAULT_BASE_URL;

  try {
    const upstream = await fetch(`${baseUrl}/api/pnl-summary`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (upstream.status === 401) {
      // TA_API_TOKEN here doesn't match the one set on zerodha-report.
      return res.status(200).json({ configured: false, error: 'token_mismatch' });
    }
    if (!upstream.ok) {
      return res.status(200).json({ configured: true, error: `trade-analytics returned ${upstream.status}` });
    }

    const summary = await upstream.json();
    return res.status(200).json({
      configured: true,
      asOf: summary.asOf,
      currentFY: summary.currentFY, // { fy, foNet, eqNet, combinedNet, foTrades, eqTrades }
      allTime: summary.allTime
    });
  } catch (error) {
    return res.status(200).json({ configured: true, error: error.message || 'Could not reach trade-analytics.' });
  }
};
