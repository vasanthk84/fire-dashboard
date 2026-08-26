// Mobile-only fixed color constants.
//
// The desktop app already hardcodes several of these same concepts
// (contribution-rate colors in Retirement401kTab.tsx, expense category
// colors in chartBuilders.ts's EXPENSE_META, fund colors in FUNDS) but at
// DIFFERENT hex values than design_handoff_fire_mobile/README.md specifies.
// Per the handoff, every hex is final and mobile must not silently drift
// from desktop's — so mobile imports its color tables from here, not from
// the desktop tab files.
//
// Semantic tone colors (--pos/--neg/--warn) and the PF bucket colors
// (cash/bonds/wheeling) ARE identical between desktop and the README, so
// those are just re-exported for a single import surface.

export const M_ACCENT = '#15a05f';
export const M_ACCENT_INK = '#0c7a47';
export const M_ACCENT_TEXT = '#4fd493';

export const M_POS = '#1faa6b';
export const M_NEG = '#e0556b';
export const M_WARN = '#d98a23';

// PF Reinvest allocation buckets
export const M_PF_CASH = '#5b9cff';
export const M_PF_BONDS = '#2dd4a7';
export const M_PF_WHEEL = '#ffb84d';

// Journey composition split
export const M_ASSET_401K = '#f472b6';
export const M_ASSET_INDIA = '#14b8a6';

// 401k employee contribution rate — keyed by the decimal fraction (0.05 etc.)
export const M_CONTRIB_COLORS: Record<number, string> = {
  0.05: '#4f9dff',
  0.07: '#2dd4a7',
  0.08: '#ffb84d',
  0.1: '#a78bfa'
};

// 401k funds — keyed by ticker
export const M_FUND_COLORS: Record<string, string> = {
  VITAX: '#4f9dff',
  JLGMX: '#2dd4a7',
  FXAIX: '#ffb84d'
};

// Expense categories — keyed by the Expenses key
export const M_EXPENSE_COLORS: Record<string, string> = {
  rent: '#4f9dff',
  groceries: '#22c55e',
  utilities: '#f59e0b',
  transport: '#a78bfa',
  health: '#ef4444',
  entertainment: '#14b8a6',
  misc: '#94a3b8'
};

// Milestone chips (Journey > Trajectory)
export const M_MILESTONE_COLORS = {
  pfClosure: '#4f9dff',
  returnToIndia: '#15a05f',
  retire: '#d98a23',
  draw401k: '#f472b6'
};

// Hero-card gradient tints per screen (see README "Hero card recipe")
export const M_HERO_TINT = {
  journey: 'rgba(21,160,95,.16)',
  k401: 'rgba(21,160,95,.16)',
  withdrawal: 'rgba(21,160,95,.16)',
  pf: 'rgba(47,109,240,.16)',
  expenses: 'rgba(224,85,107,.14)'
};
