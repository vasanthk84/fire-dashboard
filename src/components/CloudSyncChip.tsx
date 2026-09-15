import { useEffect, useState } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { fetchCloudState } from '../services/cloudSync';

type Status = 'checking' | 'unconfigured' | 'synced' | 'never-synced';

/**
 * Compact header indicator for the Upstash cloud backup that already exists
 * (see cloudSync.ts / the "Cloud sync" card in the Snapshots tab) — one blob
 * covers the FIRE plan (Journey/Risk/Expenses/Withdrawal/401k/PF Reinvest all
 * read the same Inputs state), Mutual Funds, and Snapshots, but the actual
 * Save/Load buttons only live inside the Snapshots tab, so a user working in
 * any other tab has no visibility into whether/when they last backed up.
 * This just surfaces that status everywhere and jumps to Snapshots for the
 * real controls — it doesn't duplicate Save/Load itself.
 */
export function CloudSyncChip({ onOpenSnapshots }: { onOpenSnapshots: () => void }) {
  const [status, setStatus] = useState<Status>('checking');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCloudState()
      .then(({ configured, state }) => {
        if (cancelled) return;
        if (!configured) {
          setStatus('unconfigured');
          return;
        }
        setUpdatedAt(state?.updatedAt ?? null);
        setStatus(state?.updatedAt ? 'synced' : 'never-synced');
      })
      .catch(() => {
        if (!cancelled) setStatus('unconfigured');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'checking' || status === 'unconfigured') return null;

  const label = status === 'synced' && updatedAt ? `Synced ${timeAgo(updatedAt)}` : 'Not backed up yet';

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      title="Your FIRE plan, Mutual Funds, and Snapshots all back up to one cloud copy — click to open the Save/Load controls in the Snapshots tab"
      onClick={onOpenSnapshots}
      style={{ gap: 6, color: 'var(--text-3)', fontSize: 11.5 }}
    >
      {status === 'synced' ? <Cloud size={13} /> : <CloudOff size={13} />}
      {label}
    </button>
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
