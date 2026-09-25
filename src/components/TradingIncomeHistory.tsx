import { useEffect, useState } from 'react';
import { fetchTradingIncomeHistory, type TradingIncomeHistoryResponse } from '../services/tradingIncomeHistory';
import { fmtRupees } from '../utils/formatters';

/**
 * Shows the automatic monthly assumed-vs-actual captures recorded by
 * api/monthly-income-snapshot.js (run by a Vercel Cron job once a month —
 * see vercel.json). This is a HISTORY, distinct from OptionsYieldHint's own
 * live "since {firstMonth}" trend just above it: OptionsYieldHint always
 * reflects your CURRENT assumption against the CURRENT actual trend, while
 * this shows what your assumption vs. actual looked like at each past
 * monthly checkpoint — so you can see how the gap (or lack of one) has
 * moved over time, not just where it stands today.
 *
 * Purely a read: this component never writes anything, and the capture
 * itself only ever writes into its own isolated Redis key, never into the
 * manually-saved plan or snapshot data — see api/monthly-income-snapshot.js
 * for why that isolation matters. Renders nothing while loading, on error,
 * or until there's at least one captured entry (the first capture only
 * happens once a month via the cron, so a brand-new setup will show
 * nothing here for a while — that's expected, not broken).
 */
export function TradingIncomeHistory() {
  const [data, setData] = useState<TradingIncomeHistoryResponse | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchTradingIncomeHistory()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || !data.configured || data.error || !data.history.length) return null;

  const rows = [...data.history].sort((a, b) => (a.month < b.month ? 1 : -1)); // newest first

  return (
    <div style={{ marginTop: 2, marginBottom: 6 }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ padding: '1px 6px', fontSize: 10.5 }}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▲ hide' : '▼ show'} monthly history ({rows.length})
      </button>

      {open && (
        <table style={{ width: '100%', marginTop: 6, fontSize: 10.5, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--text-3)', textAlign: 'left' }}>
              <th style={{ fontWeight: 500, paddingRight: 8 }}>Month</th>
              <th style={{ fontWeight: 500, paddingRight: 8 }}>Assumed</th>
              <th style={{ fontWeight: 500, paddingRight: 8 }}>Actual</th>
              <th style={{ fontWeight: 500 }}>Since-start P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month}>
                <td style={{ paddingRight: 8, paddingTop: 2 }}>{r.month}</td>
                <td style={{ paddingRight: 8, paddingTop: 2 }}>{r.assumedYieldPct.toFixed(1)}%</td>
                <td
                  style={{
                    paddingRight: 8,
                    paddingTop: 2,
                    color: r.diverges ? 'var(--warn, #b8860b)' : 'inherit'
                  }}
                >
                  {r.actualAnnualizedPct.toFixed(1)}%
                </td>
                <td style={{ paddingTop: 2 }}>{fmtRupees(r.totalPnlSinceStart)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
