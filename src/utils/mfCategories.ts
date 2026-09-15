import type { MFCategory } from '../types';

export const MF_CATEGORIES: Array<{ key: MFCategory; label: string; color: string }> = [
  { key: 'largeCap', label: 'Large Cap', color: '#4f8cff' },
  { key: 'flexiCap', label: 'Flexi Cap', color: '#2dd4a7' },
  { key: 'midCap', label: 'Mid Cap', color: '#f5a524' },
  { key: 'smallCap', label: 'Small Cap', color: '#f25f9c' },
  { key: 'elss', label: 'ELSS', color: '#9b8cff' },
  { key: 'index', label: 'Index', color: '#22b8cf' },
  { key: 'hybrid', label: 'Hybrid', color: '#84cc16' },
  { key: 'debt', label: 'Debt', color: '#94a3b8' },
  { key: 'international', label: 'International', color: '#a78bfa' }
];

export const MF_CATEGORY_LABEL = Object.fromEntries(MF_CATEGORIES.map((c) => [c.key, c.label])) as Record<MFCategory, string>;
export const MF_CATEGORY_COLOR = Object.fromEntries(MF_CATEGORIES.map((c) => [c.key, c.color])) as Record<MFCategory, string>;

export const MF_TXN_TYPE_LABEL: Record<string, string> = {
  purchase: 'Purchase',
  redemption: 'Redemption',
  switchIn: 'Switch In',
  switchOut: 'Switch Out',
  reversal: 'Reversal'
};
