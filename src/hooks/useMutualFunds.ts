import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { MFBenchmarks, MFCategory, MFSipMandate, MFStpPlan, MFTransaction, MutualFund } from '../types';
import { computeFundMetrics, portfolioXIRR } from '../utils/mfAnalysis';
import type { CASImportSelection } from '../utils/mfCasImport';
import { buildFundsFromCAS } from '../utils/mfCasImport';

const STORAGE_KEY = 'fire-mf-portfolio-v1';

export const DEFAULT_MF_BENCHMARKS: MFBenchmarks = {
  largeCap: 12,
  flexiCap: 13,
  midCap: 15,
  smallCap: 16,
  elss: 13,
  index: 12,
  hybrid: 10,
  debt: 7,
  international: 11
};

export const DEFAULT_TIER_THRESHOLD_PCT = 2;

interface PersistedMFPortfolio {
  funds: MutualFund[];
  benchmarks: MFBenchmarks;
  tierThresholdPct: number;
}

function readPersisted(): PersistedMFPortfolio {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { funds: [], benchmarks: DEFAULT_MF_BENCHMARKS, tierThresholdPct: DEFAULT_TIER_THRESHOLD_PCT };
    const parsed = JSON.parse(raw);
    return {
      funds: Array.isArray(parsed?.funds) ? parsed.funds : [],
      benchmarks: { ...DEFAULT_MF_BENCHMARKS, ...(parsed?.benchmarks ?? {}) },
      tierThresholdPct: typeof parsed?.tierThresholdPct === 'number' ? parsed.tierThresholdPct : DEFAULT_TIER_THRESHOLD_PCT
    };
  } catch {
    return { funds: [], benchmarks: DEFAULT_MF_BENCHMARKS, tierThresholdPct: DEFAULT_TIER_THRESHOLD_PCT };
  }
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useMutualFunds() {
  const initial = useMemo(() => readPersisted(), []);
  const [funds, setFunds] = useState<MutualFund[]>(initial.funds);
  const [benchmarks, setBenchmarks] = useState<MFBenchmarks>(initial.benchmarks);
  const [tierThresholdPct, setTierThresholdPct] = useState<number>(initial.tierThresholdPct);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ funds, benchmarks, tierThresholdPct }));
    } catch {
      // ignore — private browsing, quota exceeded, or storage disabled
    }
  }, [funds, benchmarks, tierThresholdPct]);

  const addFund = (fund: Omit<MutualFund, 'id' | 'transactions'>): string => {
    const id = genId('mf');
    setFunds((prev) => [...prev, { ...fund, id, transactions: [] }]);
    return id;
  };

  const updateFund = (id: string, patch: Partial<Omit<MutualFund, 'id' | 'transactions'>>) => {
    setFunds((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const deleteFund = (id: string) => {
    setFunds((prev) => prev.filter((f) => f.id !== id));
  };

  const addTransaction = (fundId: string, txn: Omit<MFTransaction, 'id'>) => {
    const id = genId('txn');
    setFunds((prev) =>
      prev.map((f) =>
        f.id === fundId
          ? { ...f, transactions: [...f.transactions, { ...txn, id }].sort((a, b) => a.date.localeCompare(b.date)) }
          : f
      )
    );
  };

  const deleteTransaction = (fundId: string, txnId: string) => {
    setFunds((prev) =>
      prev.map((f) => (f.id === fundId ? { ...f, transactions: f.transactions.filter((t) => t.id !== txnId) } : f))
    );
  };

  const addStpPlan = (fundId: string, plan: Omit<MFStpPlan, 'id'>) => {
    const id = genId('stp');
    setFunds((prev) =>
      prev.map((f) => (f.id === fundId ? { ...f, stpPlans: [...(f.stpPlans ?? []), { ...plan, id }] } : f))
    );
  };

  const deleteStpPlan = (fundId: string, stpId: string) => {
    setFunds((prev) =>
      prev.map((f) => (f.id === fundId ? { ...f, stpPlans: (f.stpPlans ?? []).filter((s) => s.id !== stpId) } : f))
    );
  };

  const addSipMandate = (fundId: string, mandate: Omit<MFSipMandate, 'id'>) => {
    const id = genId('sip');
    setFunds((prev) =>
      prev.map((f) => (f.id === fundId ? { ...f, sipMandates: [...(f.sipMandates ?? []), { ...mandate, id }] } : f))
    );
  };

  const deleteSipMandate = (fundId: string, mandateId: string) => {
    setFunds((prev) =>
      prev.map((f) => (f.id === fundId ? { ...f, sipMandates: (f.sipMandates ?? []).filter((m) => m.id !== mandateId) } : f))
    );
  };

  const updateBenchmark = (category: MFCategory, value: number) => {
    setBenchmarks((prev) => ({ ...prev, [category]: value }));
  };

  const resetBenchmarks = () => setBenchmarks(DEFAULT_MF_BENCHMARKS);

  const existingCasKeys = useMemo(
    () => new Set(funds.filter((f) => f.casKey).map((f) => f.casKey as string)),
    [funds]
  );

  /** Upserts by casKey: a fund already tracked from an earlier CAS import is
   *  replaced in place (its id is kept) rather than duplicated, since the same
   *  folio/scheme re-imported later should just refresh, not double-count. */
  const importFromCAS = (parsed: Parameters<typeof buildFundsFromCAS>[0], selections: Record<string, CASImportSelection>) => {
    const incoming = buildFundsFromCAS(parsed, selections);
    setFunds((prev) => {
      const byCasKey = new Map(prev.filter((f) => f.casKey).map((f) => [f.casKey as string, f]));
      const next = prev.filter((f) => !f.casKey || !incoming.some((inc) => inc.casKey === f.casKey));
      for (const fund of incoming) {
        const existing = fund.casKey ? byCasKey.get(fund.casKey) : undefined;
        next.push(existing ? { ...fund, id: existing.id } : fund);
      }
      return next;
    });
    return incoming.length;
  };

  /** Wipes all tracked funds/transactions (used by "Reset & re-import").
   *  Benchmarks and the tier threshold are deliberately left untouched — those
   *  are user-tuned settings, not portfolio data. */
  const resetPortfolio = () => setFunds([]);

  const metrics = useMemo(
    () => funds.map((f) => computeFundMetrics(f, benchmarks, tierThresholdPct)),
    [funds, benchmarks, tierThresholdPct]
  );

  const totals = useMemo(() => {
    const invested = metrics.reduce((s, m) => s + m.invested, 0);
    const currentValue = funds.reduce((s, f) => s + f.currentValue, 0);
    const gain = currentValue - invested;
    return {
      invested,
      currentValue,
      gain,
      gainPct: invested > 0 ? gain / invested : null,
      blendedXirr: portfolioXIRR(funds)
    };
  }, [metrics, funds]);

  const exportPortfolio = () => {
    const blob = new Blob(
      [JSON.stringify({ version: '1.0', exportDate: new Date().toISOString(), funds, benchmarks, tierThresholdPct }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `MF-Portfolio-${new Date().toISOString().split('T')[0]}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importPortfolio = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const data = JSON.parse(String(loadEvent.target?.result ?? '{}')) as Partial<PersistedMFPortfolio>;
        if (!Array.isArray(data.funds)) {
          window.alert('Invalid MF portfolio file — expected a "funds" array.');
          return;
        }
        setFunds(data.funds);
        if (data.benchmarks) setBenchmarks({ ...DEFAULT_MF_BENCHMARKS, ...data.benchmarks });
        if (typeof data.tierThresholdPct === 'number') setTierThresholdPct(data.tierThresholdPct);
        window.alert(`Imported ${data.funds.length} fund(s).`);
      } catch (error) {
        window.alert(`Failed to import: ${(error as Error).message}`);
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return {
    funds,
    benchmarks,
    tierThresholdPct,
    metrics,
    totals,
    setTierThresholdPct,
    addFund,
    updateFund,
    deleteFund,
    addTransaction,
    deleteTransaction,
    addStpPlan,
    deleteStpPlan,
    addSipMandate,
    deleteSipMandate,
    updateBenchmark,
    resetBenchmarks,
    exportPortfolio,
    importPortfolio,
    importFromCAS,
    resetPortfolio,
    existingCasKeys
  };
}

export type UseMutualFundsReturn = ReturnType<typeof useMutualFunds>;
