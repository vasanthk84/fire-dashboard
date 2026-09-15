/**
 * Maps a casparser-parsed CAS statement (see scripts/parse_cas.py and the
 * CAS* types in types.ts) into this app's MutualFund/MFTransaction shape.
 *
 * casparser has already done the hard part: 300+ raw CAMS/KFintech transaction
 * description strings collapse into a small clean `type` enum with correctly
 * signed amounts (verified against a real 41-page multi-AMC statement — zero
 * parse warnings, including a bounced/reversed SIP installment). What's left
 * here is app-specific: which of those types belong in the XIRR ledger, a
 * best-effort category guess from the scheme name, and building the "review
 * before import" rows the UI shows.
 */

import type { CASFolioRaw, CASParseResult, CASSchemeRaw, CASTransactionRaw, MFCategory, MFPlan, MFTransaction, MFTxnType, MutualFund } from '../types';
import { genId } from './id';

/** casparser transaction `type` → our MFTxnType, for the types that represent
 *  a real change in what you hold (and so belong in the XIRR cash-flow ledger).
 *  Anything not listed here (MISC, STT_TAX, STAMP_DUTY_TAX, DIVIDEND payouts,
 *  segregated-portfolio markers, etc.) is deliberately left out — see
 *  mapCasTransactions below for why STT/stamp duty are tracked separately
 *  instead of silently dropped. */
const CAS_TYPE_MAP: Record<string, MFTxnType> = {
  PURCHASE: 'purchase',
  PURCHASE_SIP: 'purchase',
  REDEMPTION: 'redemption',
  SWITCH_IN: 'switchIn',
  SWITCH_OUT: 'switchOut',
  REVERSAL: 'reversal'
};

const CHARGE_TYPES = new Set(['STT_TAX', 'STAMP_DUTY_TAX']);

/** Below this, floating-point drift in casparser's own running unit balance
 *  (or in a switch that leaves a dust fraction behind) still counts as fully
 *  exited — a real remaining position is never this small a fraction of a unit. */
const CLOSED_UNITS_EPSILON = 0.001;

export function isClosedScheme(scheme: CASSchemeRaw): boolean {
  return Math.abs(scheme.close) < CLOSED_UNITS_EPSILON;
}

/** casparser doesn't format a folio number 100% consistently across exports —
 *  confirmed on the user's real files, all for the same physical folio+ISIN:
 *  a combined CAMS+KFintech export ("Report.pdf") consistently appends a
 *  "/0" no-sub-account suffix ("2107316452/0"), a KFintech-only export
 *  ("KFIntech_detailed_transaction.pdf") consistently omits it for the exact
 *  same folio ("2107316452"), and both vary in whitespace around a non-zero
 *  sub-account suffix ("10544357 / 84" vs "10544357/ 84"). Left unnormalized,
 *  either difference alone would make `mfKeyFor` mint two different casKeys
 *  for one holding — upsert-by-casKey would then silently create a duplicate
 *  fund instead of updating the existing one, on nothing more than which PDF
 *  export happened to be uploaded. Collapsing whitespace around the "/" and
 *  dropping a trailing "/0" makes the key robust to both (verified: after
 *  this normalization, all 27 active folios in the user's combined CAMS
 *  export match exactly against their counterparts in the fuller KFintech
 *  export, with zero leftover mismatches). */
export function normalizeFolio(folioNo: string): string {
  return folioNo.trim().replace(/\s*\/\s*/g, '/').replace(/\/0$/, '');
}

export function mfKeyFor(folioNo: string, isin: string): string {
  return `${normalizeFolio(folioNo)}|${isin}`;
}

/** casparser's `valuation.cost` isn't always present — observed null across an
 *  entire real statement — and is never used for the headline invested/gain
 *  figures (see the long comment on MutualFund.importedCost in types.ts), so
 *  this only matters for the informational figure. `Number(null ?? 0)` would
 *  silently turn "unknown" into "zero", which reads very differently in the UI
 *  ("₹0 cost basis" vs "not reported") — keep it undefined instead. */
function parseCost(raw: string | null | undefined): number | undefined {
  return raw !== null && raw !== undefined ? Number(raw) : undefined;
}

/** Splits a scheme's raw CAS transactions into the ones that belong in the
 *  XIRR ledger and a running total of stamp duty + STT (shown to the user as
 *  an informational figure, never included in a cash flow). */
export function mapCasTransactions(raw: CASTransactionRaw[]): { transactions: MFTransaction[]; charges: number } {
  const transactions: MFTransaction[] = [];
  let charges = 0;

  for (const t of raw) {
    if (t.amount === null) continue; // pure annotation line (KYC/nominee/address updates, cancellations, ...)
    const amt = Number(t.amount);
    if (!Number.isFinite(amt)) continue;

    if (CHARGE_TYPES.has(t.type)) {
      charges += Math.abs(amt);
      continue;
    }

    const mapped = CAS_TYPE_MAP[t.type];
    if (!mapped) continue; // MISC and anything else we don't have a ledger slot for

    transactions.push({
      id: genId('txn'),
      date: t.date,
      type: mapped,
      amount: amt,
      units: t.units !== null && t.units !== undefined ? Number(t.units) : undefined
    });
  }

  return { transactions, charges };
}

const CATEGORY_PATTERNS: Array<[RegExp, MFCategory]> = [
  [/elss|tax saver/i, 'elss'],
  [/\bindex\b|nifty|sensex|\betf\b/i, 'index'],
  [/small\s*cap/i, 'smallCap'],
  [/mid\s*cap/i, 'midCap'],
  [/large\s*cap|bluechip|blue\s*chip/i, 'largeCap'],
  [/flexi\s*cap|multi\s*cap/i, 'flexiCap'],
  [/hybrid|balanced advantage|aggressive hybrid|equity savings|\bbalanced\b/i, 'hybrid'],
  [/international|global|nasdaq|overseas|emerging market|\bus\s/i, 'international'],
  [/\bdebt\b|liquid|gilt|\bbond\b|banking\s*(&|and)\s*psu|money market|fund of fund|\bfof\b/i, 'debt']
];

/** Best-effort category guess from the scheme name (and casparser's coarse
 *  EQUITY/DEBT/HYBRID `type` as a fallback) — shown as an editable default in
 *  the review step, never applied silently for the final tier calculation. */
export function guessMFCategory(schemeName: string, schemeType?: string): MFCategory {
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(schemeName)) return category;
  }
  if (schemeType === 'DEBT') return 'debt';
  if (schemeType === 'HYBRID') return 'hybrid';
  return 'flexiCap';
}

export function guessMFPlan(schemeName: string): MFPlan {
  return /regular/i.test(schemeName) ? 'regular' : 'direct';
}

export interface CASReviewRow {
  key: string; // folio|isin
  amc: string;
  folio: string;
  schemeName: string;
  category: MFCategory;
  plan: MFPlan;
  txnCount: number;
  charges: number;
  currentValue: number;
  cost: number;
  asOfDate: string;
  include: boolean;
  isUpdate: boolean; // true when a fund with this key already exists in the tracker
  closed: boolean; // true when casparser reports ~0 closing units — fully redeemed/switched out
}

/** Flattens every folio/scheme in a parsed CAS into review rows, without
 *  touching any app state — the UI lets the user edit category/plan/include
 *  before anything is actually written via useMutualFunds().importFromCAS(). */
export function buildCASReviewRows(parsed: CASParseResult, existingKeys: Set<string>): CASReviewRow[] {
  const rows: CASReviewRow[] = [];
  for (const folio of parsed.folios as CASFolioRaw[]) {
    for (const scheme of folio.schemes as CASSchemeRaw[]) {
      const key = mfKeyFor(folio.folio, scheme.isin);
      const { transactions, charges } = mapCasTransactions(scheme.transactions);
      rows.push({
        key,
        amc: folio.amc,
        folio: folio.folio,
        schemeName: scheme.scheme,
        category: guessMFCategory(scheme.scheme, scheme.type),
        plan: guessMFPlan(scheme.scheme),
        txnCount: transactions.length,
        charges,
        currentValue: Number(scheme.valuation?.value ?? 0),
        cost: Number(scheme.valuation?.cost ?? 0),
        asOfDate: scheme.valuation?.date ?? new Date().toISOString().slice(0, 10),
        include: true,
        isUpdate: existingKeys.has(key),
        closed: isClosedScheme(scheme)
      });
    }
  }
  return rows;
}

export interface CASSourceFile {
  parsed: CASParseResult;
  fileName: string;
}

/** True when `candidate` is the more complete record for the same folio+ISIN
 *  — more transaction history wins; a tie (e.g. two files covering the exact
 *  same range) falls back to whichever has the more recent valuation date. */
function isRicherScheme(candidate: CASSchemeRaw, current: CASSchemeRaw): boolean {
  if (candidate.transactions.length !== current.transactions.length) {
    return candidate.transactions.length > current.transactions.length;
  }
  return (candidate.valuation?.date ?? '') > (current.valuation?.date ?? '');
}

/**
 * Merges multiple parsed CAS statements into one, for the common case of a
 * user uploading more than one CAS PDF together — e.g. a combined
 * CAMS+KFintech statement plus a separately-downloaded KFintech-only one that
 * covers a wider date range. No cross-file transaction reconciliation is
 * needed: every holding is already keyed by folio+ISIN (`casKey`), the same
 * key `useMutualFunds().importFromCAS()` upserts on, so merging is just
 * picking — for each casKey that shows up in more than one file — whichever
 * file's copy of that scheme is the fuller one (see `isRicherScheme`).
 * Folios/schemes that only appear in one file pass through unchanged. This is
 * order-independent: it doesn't matter which file the user picks first.
 */
export function mergeCasResults(sources: CASSourceFile[]): CASParseResult {
  if (sources.length === 1) return sources[0].parsed;

  // Grouped by the normalized folio number (see normalizeFolio) so that the
  // same real folio spelled slightly differently across exports collapses
  // into one folio entry, not two — matching how mfKeyFor already dedupes
  // individual scheme rows.
  const bestByKey = new Map<string, { folioNorm: string; scheme: CASSchemeRaw }>();
  const folioShellByNorm = new Map<string, CASFolioRaw>();

  for (const { parsed } of sources) {
    for (const folio of parsed.folios as CASFolioRaw[]) {
      const folioNorm = normalizeFolio(folio.folio);
      if (!folioShellByNorm.has(folioNorm)) folioShellByNorm.set(folioNorm, folio);
      for (const scheme of folio.schemes as CASSchemeRaw[]) {
        const key = mfKeyFor(folio.folio, scheme.isin);
        const existing = bestByKey.get(key);
        if (!existing || isRicherScheme(scheme, existing.scheme)) {
          bestByKey.set(key, { folioNorm, scheme });
        }
      }
    }
  }

  // Second pass: a pure "holdings summary" export (no transactions at all)
  // was observed dropping a folio's sub-account suffix entirely rather than
  // using "/0" for "none" — bare "10544357" where every other export for the
  // same holding says "10544357/84". That's indistinguishable from
  // normalizeFolio's output for a genuinely *different* sub-account, so it
  // can't be folded into the normalization above safely. Instead, only
  // within a (base-folio, ISIN) group where at least one entry has zero
  // transactions (i.e. is plausibly one of these no-transaction snapshot
  // rows) do we collapse the group to its richest member — never when every
  // member already has real transaction history, since that would risk
  // merging two genuinely distinct sub-accounts of the same base folio.
  // Verified against the user's real files: this is exactly what's needed to
  // fold the 9 zero-transaction rows a holdings-only summary PDF contributed
  // back into their already-present, transaction-rich counterparts.
  const baseFolioOf = (folioNorm: string) => folioNorm.split('/')[0];
  const groups = new Map<string, string[]>(); // "baseFolio|isin" -> casKeys
  for (const [key, { folioNorm, scheme }] of bestByKey.entries()) {
    const gkey = `${baseFolioOf(folioNorm)}|${scheme.isin}`;
    const list = groups.get(gkey);
    if (list) list.push(key);
    else groups.set(gkey, [key]);
  }
  for (const keys of groups.values()) {
    if (keys.length < 2) continue;
    const entries = keys.map((k) => ({ key: k, entry: bestByKey.get(k)! }));
    const hasZero = entries.some((e) => e.entry.scheme.transactions.length === 0);
    const allNonZero = entries.every((e) => e.entry.scheme.transactions.length > 0);
    if (!hasZero || allNonZero) continue; // ambiguous, or nothing to collapse — leave the group as-is
    const richest = entries.reduce((a, b) => (b.entry.scheme.transactions.length > a.entry.scheme.transactions.length ? b : a));
    for (const { key } of entries) {
      if (key !== richest.key) bestByKey.delete(key);
    }
  }

  const folioMap = new Map<string, CASFolioRaw>();
  for (const { folioNorm, scheme } of bestByKey.values()) {
    let target = folioMap.get(folioNorm);
    if (!target) {
      target = { ...(folioShellByNorm.get(folioNorm) as CASFolioRaw), schemes: [] };
      folioMap.set(folioNorm, target);
    }
    target.schemes.push(scheme);
  }

  const widestPeriod = sources.reduce(
    (acc, { parsed }) => ({
      from: !acc.from || (parsed.statement_period?.from && parsed.statement_period.from < acc.from) ? parsed.statement_period?.from ?? acc.from : acc.from,
      to: !acc.to || (parsed.statement_period?.to && parsed.statement_period.to > acc.to) ? parsed.statement_period?.to ?? acc.to : acc.to
    }),
    { from: '', to: '' }
  );

  return {
    ...sources[0].parsed,
    statement_period: widestPeriod,
    folios: Array.from(folioMap.values()),
    parse_warnings: sources.flatMap(({ parsed, fileName }) => (parsed.parse_warnings ?? []).map((w) => `${fileName}: ${w}`))
  };
}

export interface CASImportSelection {
  include: boolean;
  category: MFCategory;
  plan: MFPlan;
}

/** Builds the actual MutualFund objects to upsert, applying the user's review
 *  edits (or the original guesses, for a row they left untouched). Pure
 *  function — the hook does the actual upsert-by-casKey into state. */
export function buildFundsFromCAS(
  parsed: CASParseResult,
  selections: Record<string, CASImportSelection>
): MutualFund[] {
  const funds: MutualFund[] = [];
  for (const folio of parsed.folios as CASFolioRaw[]) {
    for (const scheme of folio.schemes as CASSchemeRaw[]) {
      const key = mfKeyFor(folio.folio, scheme.isin);
      const sel = selections[key];
      if (!sel || !sel.include) continue;

      const { transactions, charges } = mapCasTransactions(scheme.transactions);
      funds.push({
        id: genId('mf'),
        name: scheme.scheme,
        category: sel.category,
        plan: sel.plan,
        currentValue: Number(scheme.valuation?.value ?? 0),
        asOfDate: scheme.valuation?.date ?? new Date().toISOString().slice(0, 10),
        transactions,
        casKey: key,
        folio: folio.folio,
        charges,
        importedCost: parseCost(scheme.valuation?.cost),
        closingUnits: scheme.close
      });
    }
  }
  return funds;
}
