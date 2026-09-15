import { Landmark, PiggyBank, SlidersHorizontal, TrendingUp, Wallet } from 'lucide-react';
import type { MobileTab } from '../MobileApp';

const NAV_ITEMS: Array<{ key: MobileTab; label: string; icon: typeof TrendingUp }> = [
  { key: 'journey', label: 'Journey', icon: TrendingUp },
  { key: 'expenses', label: 'Expenses', icon: Wallet },
  { key: 'retirement', label: 'Retirement', icon: Landmark },
  { key: 'mutualFunds', label: 'Mutual Funds', icon: PiggyBank },
  { key: 'setup', label: 'Assumptions', icon: SlidersHorizontal }
];

export function BottomNav({ active, onChange }: { active: MobileTab; onChange: (tab: MobileTab) => void }) {
  return (
    <div className="m-bottom-nav">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            className={'m-nav-btn' + (isActive ? ' active' : '')}
            onClick={() => onChange(item.key)}
          >
            <Icon size={20} strokeWidth={1.8} />
            <span className="m-nav-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
