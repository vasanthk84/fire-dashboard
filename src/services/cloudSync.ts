/**
 * Optional cloud backup for this app's data. Everything today lives only in
 * the browser's localStorage (see src/utils/persistence.ts,
 * src/hooks/useMutualFunds.ts, src/hooks/useSnapshots.ts) — real, but it
 * doesn't survive a cleared cache, a new device, or a new browser. This adds
 * an explicit, user-triggered backup/restore against a free Upstash Redis
 * instance (see api/state.js for the server side and setup instructions),
 * reachable identically from local dev and the deployed Vercel site.
 *
 * Deliberately explicit ("Save to cloud" / "Load from cloud" buttons) rather
 * than automatic background sync: this app has no login, so there's exactly
 * one shared cloud copy — silently pushing on every keystroke from every
 * open tab/device risks a background tab clobbering what you just typed
 * elsewhere. This mirrors the Export/Import JSON buttons the Snapshots tab
 * already has, just backed by a server instead of a downloaded file.
 *
 * Auth: api/state.js now requires a bearer token (SYNC_TOKEN server-side)
 * on every request — it used to trust the deployed URL as access control,
 * which a plain unauthenticated GET could defeat. VITE_SYNC_TOKEN (must
 * match SYNC_TOKEN) is baked into this client bundle at build time and
 * sent below, same pattern oi-analyzer's VITE_ADMIN_SECRET already uses.
 * If VITE_SYNC_TOKEN isn't set, requests still go out with no Authorization
 * header — api/state.js just reports back `configured: false`, same as
 * today when Upstash itself isn't configured, so nothing breaks either way.
 */

// The localStorage keys this app actually stores real data under. UI-only
// preferences (theme/layout/color hue) are deliberately excluded — those are
// meant to differ per device/browser, not sync.
export const CLOUD_SYNC_KEYS = ['fire-planner-plan-v1', 'fire-mf-portfolio-v1', 'fire-snapshots'] as const;

export interface CloudStateResponse {
  configured: boolean;
  state?: (Record<string, unknown> & { updatedAt?: string }) | null;
}

function authHeaders(): Record<string, string> {
  const token = import.meta.env.VITE_SYNC_TOKEN as string | undefined;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchCloudState(): Promise<CloudStateResponse> {
  const response = await fetch('/api/state', { headers: authHeaders() });
  if (!response.ok) throw new Error('Could not reach cloud sync.');
  return response.json();
}

/** Reads every synced localStorage key (parsed from its stored JSON string)
 *  and pushes them as one blob. A key that's simply empty locally (e.g. no
 *  snapshots saved yet) is sent as null rather than omitted, so a stale
 *  cloud copy from a previous save doesn't linger forever. */
export async function pushCloudState(): Promise<{ updatedAt: string }> {
  const state: Record<string, unknown> = {};
  for (const key of CLOUD_SYNC_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      state[key] = null;
      continue;
    }
    try {
      state[key] = JSON.parse(raw);
    } catch {
      state[key] = null; // corrupted local value — don't propagate garbage to the cloud copy
    }
  }

  const response = await fetch('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(state)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.saved) {
    throw new Error(data?.error || 'Failed to save to cloud.');
  }
  return { updatedAt: data.updatedAt as string };
}

/** Writes the cloud copy's keys back into localStorage. Doesn't update React
 *  state itself — every hook here reads localStorage once, on mount — so the
 *  caller is expected to reload the page right after this resolves. */
export async function pullCloudState(): Promise<{ updatedAt?: string }> {
  const { configured, state } = await fetchCloudState();
  if (!configured) throw new Error("Cloud sync isn't set up yet.");
  if (!state) throw new Error('No cloud backup found yet — save one first.');

  for (const key of CLOUD_SYNC_KEYS) {
    const value = state[key];
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  }
  return { updatedAt: state.updatedAt };
}
