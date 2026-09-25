// Same annualization as the displayed expiry-month trend; rates are fractions.
function resolveOptionsYield(summary, capitalLakhs, assumedRate) {
  const fallback = reason => ({ source: 'assumed', annualRate: assumedRate, reason, months: 0 });
  if (!(Number.isFinite(capitalLakhs) && capitalLakhs > 0)) return fallback('Enter a positive options portfolio value');
  if (!summary.configured || summary.error) return fallback(summary.error || 'TA_API_TOKEN is not configured');
  const months = summary.monthlyFO;
  if (!Array.isArray(months) || !months.length) return fallback('No monthly F&O history available');
  if (months.some(m => !m || !Number.isFinite(m.pnl))) return fallback('Invalid monthly F&O history');
  const annualRate = months.reduce((sum, m) => sum + m.pnl, 0) / months.length * 12 / (capitalLakhs * 100000);
  if (!Number.isFinite(annualRate)) return fallback('Invalid actual yield');
  return { source: 'actual', annualRate, months: months.length, asOf: summary.asOf };
}
module.exports = { resolveOptionsYield };
