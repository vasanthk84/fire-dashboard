/**
 * Shared fetch-from-trade-analytics logic, used by api/trading-income.js
 * (the live browser-facing hint) and api/monthly-income-snapshot.js (the
 * automatic monthly capture). Split out so both call sites stay byte-for-
 * byte consistent about what "actual realized options income" means,
 * rather than two independently-maintained fetches that could drift.
 *
 * Deliberately proxies only the aggregate /api/pnl-summary endpoint, never
 * /api/trades — nothing downstream of this has business seeing per-trade
 * rows, only the net P&L totals.
 */
const DEFAULT_BASE_URL = 'https://zerodha-report.vercel.app';

/**
 * Returns the same shape api/trading-income.js has always returned to the
 * browser: { configured, error?, asOf?, currentFY?, allTime?, byFY?,
 * monthlyFO? }. Never throws — a missing token or an unreachable/erroring
 * upstream both come back as a normal object with configured:false/error
 * set, exactly like today, so callers don't need their own try/catch.
 */
async function fetchTradingIncomeSummary() {
  const token = process.env.TA_API_TOKEN;
  if (!token) {
    return { configured: false };
  }

  const baseUrl = process.env.TRADE_ANALYTICS_URL || DEFAULT_BASE_URL;

  try {
    const upstream = await fetch(`${baseUrl}/api/pnl-summary`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (upstream.status === 401) {
      // TA_API_TOKEN here doesn't match the one set on zerodha-report.
      return { configured: false, error: 'token_mismatch' };
    }
    if (!upstream.ok) {
      return { configured: true, error: `trade-analytics returned ${upstream.status}` };
    }

    const summary = await upstream.json();
    return {
      configured: true,
      asOf: summary.asOf,
      currentFY: summary.currentFY, // { fy, foNet, eqNet, combinedNet, foTrades, eqTrades }
      allTime: summary.allTime,
      byFY: summary.byFY, // [{ fy, foNet, eqNet, combinedNet, foTrades, eqTrades }, ...] every FY on record
      monthlyFO: summary.monthlyFO // [{ month, pnl, trades }, ...] gross F&O pnl since wheeling started
    };
  } catch (error) {
    return { configured: true, error: error.message || 'Could not reach trade-analytics.' };
  }
}

module.exports = { fetchTradingIncomeSummary };
