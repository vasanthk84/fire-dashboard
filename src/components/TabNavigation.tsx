import { Camera, DollarSign, Map, Shield, TrendingDown } from 'lucide-react';
import { tabs } from '../constants';
import type { TabKey } from '../types';

const iconMap = {
  journey: Map,
  risk: Shield,
  expenses: DollarSign,
  withdrawal: TrendingDown,
  snapshots: Camera
};

interface TabNavigationProps {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}

export function TabNavigation({ activeTab, onChange }: TabNavigationProps) {
  return (
    <div className="tabs">
      {tabs.map((tab) => {
        const Icon = iconMap[tab.key];
        return (
          <button key={tab.key} className={`tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => onChange(tab.key)}>
            <Icon size={14} /> {tab.label}
          </button>
        );
      })}
    </div>
  );
}
