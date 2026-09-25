/**
 * GET /api/options-capital — actual capital currently deployed in OPEN CC/CSP
 * wheel cycles, read from the oi-analyzer app (D:\oi-analyzer), so the
 * "Options income" card can show the REAL deployed capital next to the
 * assumed `optionsPortfolioValue` you type in by hand — same idea as
 * api/trading-income.js's actual-vs-assumed yield, just for the other input
 * that widget's percentage is calculated against.
 *
 * Same shared-module pattern as api/state.js and api/trading-income.js:
 * one `module.exports = async (req, res) => {...}` — server.js `require()`s
 * it directly for local dev, Vercel auto-detects this file as its own
 * serverless function for production.
 *
 * This is a SERVER-SIDE call only — the Bearer token never reaches the
 * browser. Configure via:
 *   OI_ANALYZER_TOKEN — same shared secret set as FIRE_DASHBOARD_TOKEN on
 *                        the oi-analyzer backend (see backend/api/routes/
 *                        wheel_journal.py's _check_fire_dashboard_token)
 *   OI_ANALYZER_URL   — optional override; defaults to the production
 *                        droplet below
 * Add both to `.env`/`.env.local` for local dev and to this Vercel
 * project's Environment Variables for production. Until OI_ANALYZER_TOKEN
 * is set, every request responds 200 with `{ configured: false }` — same
 * "not broken, just not set up yet" pattern the other two proxies use.
 *
 * NOTE: oi-analyzer's backend is only reachable over plain HTTP (no TLS) —
 * see OI_ANALYZER_URL's default below. That's an accepted, pre-existing
 * exposure on that app (its own SITE_PASSWORD/ADMIN_SECRET already cross
 * this same link), not something introduced here, but worth knowing if
 * you're ever deciding whether to relax it.
 */
const DEFAULT_BASE_URL = 'http://165.227.84.87:82';

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.OI_ANALYZER_TOKEN;
  if (!token) {
    // Not an error — mirrors api/state.js's "nothing to do yet" convention.
    return res.status(200).json({ configured: false });
  }

  const baseUrl = process.env.OI_ANALYZER_URL || DEFAULT_BASE_URL;

  try {
    const upstream = await fetch(`${baseUrl}/api/wheel-journal/external/capital`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (upstream.status === 401) {
      // OI_ANALYZER_TOKEN here doesn't match FIRE_DASHBOARD_TOKEN on oi-analyzer.
      return res.status(200).json({ configured: false, error: 'token_mismatch' });
    }
    if (upstream.status === 503) {
      // oi-analyzer's endpoint exists but FIRE_DASHBOARD_TOKEN isn't set there.
      return res.status(200).json({ configured: false, error: 'not_configured_upstream' });
    }
    if (!upstream.ok) {
      return res.status(200).json({ configured: true, error: `oi-analyzer returned ${upstream.status}` });
    }

    const data = await upstream.json();
    return res.status(200).json({
      configured: true,
      asOf: data.asOf,
      openCapitalDeployedRupees: data.open_capital_deployed // rupees, not lakhs — convert in the UI
    });
  } catch (error) {
    return res.status(200).json({ configured: true, error: error.message || 'Could not reach oi-analyzer.' });
  }
};
