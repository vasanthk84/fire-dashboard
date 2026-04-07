import { useEffect, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import type { Expenses, Inputs, OneTimeExpenses, Snapshot } from '../types';

function readSnapshots(): Snapshot[] {
  const saved = window.localStorage.getItem('fire-snapshots');
  if (!saved) {
    return [];
  }

  try {
    return JSON.parse(saved) as Snapshot[];
  } catch {
    return [];
  }
}

interface UseSnapshotsProps {
  inputs: Inputs;
  expenses: Expenses;
  oneTimeExpenses: OneTimeExpenses;
  showOneTime: boolean;
  results: { summary: { startWealth: number; finalWealth: number } } | null;
  fireNumberLakhs: number;
  yearsToFI: number | null;
  progressToFire: number;
  setInputs: Dispatch<SetStateAction<Inputs>>;
  setExpenses: Dispatch<SetStateAction<Expenses>>;
  setOneTimeExpenses: Dispatch<SetStateAction<OneTimeExpenses>>;
  setShowOneTime: Dispatch<SetStateAction<boolean>>;
  initialOneTimeExpenses: OneTimeExpenses;
  runCalculation: (overrides?: Partial<Inputs>) => Promise<unknown>;
  sumExpenses: <T extends object>(values: T) => number;
}

export function useSnapshots(props: UseSnapshotsProps) {
  const {
    inputs,
    expenses,
    oneTimeExpenses,
    showOneTime,
    results,
    fireNumberLakhs,
    yearsToFI,
    progressToFire,
    setInputs,
    setExpenses,
    setOneTimeExpenses,
    setShowOneTime,
    initialOneTimeExpenses,
    runCalculation,
    sumExpenses
  } = props;

  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => readSnapshots());
  const [selectedSnapshots, setSelectedSnapshots] = useState<string[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [snapshotNotes, setSnapshotNotes] = useState('');
  const [snapshotTags, setSnapshotTags] = useState<string[]>([]);

  useEffect(() => {
    if (snapshots.length === 0) {
      window.localStorage.removeItem('fire-snapshots');
      return;
    }

    window.localStorage.setItem('fire-snapshots', JSON.stringify(snapshots));
  }, [snapshots]);

  const addTag = (tag: string) => {
    if (tag && !snapshotTags.includes(tag)) {
      setSnapshotTags((prev) => [...prev, tag]);
    }
  };

  const removeTag = (tag: string) => {
    setSnapshotTags((prev) => prev.filter((item) => item !== tag));
  };

  const saveSnapshot = () => {
    if (!results) {
      window.alert('Please run calculation first');
      return;
    }

    const snapshot: Snapshot = {
      modelId: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      snapshotDate: new Date().toISOString(),
      label: snapshotLabel || `Snapshot ${new Date().toLocaleDateString()}`,
      tags: snapshotTags,
      notes: snapshotNotes,
      assets: {
        mfCurrent: inputs.mfCurrent,
        stocksIndia: inputs.stocksIndia,
        usStocks: inputs.usStocks,
        emergencyFund: inputs.emergencyFund,
        epfCurrent: inputs.epfCurrent,
        bondsInitial: inputs.bondsInitial,
        us401k: inputs.us401k,
        usdExchangeRate: inputs.usdExchangeRate
      },
      flows: {
        mfSIP: inputs.mfSIP,
        sipStepUpRate: inputs.sipStepUpRate,
        optionSellingMonthly: inputs.optionSellingMonthly,
        annualSalary: inputs.annualSalary,
        basicPay: inputs.basicPay
      },
      growthRates: {
        mfRate: inputs.mfRate,
        stocksRate: inputs.stocksRate,
        usRate: inputs.usRate,
        inflationRate: inputs.inflationRate
      },
      bonds: {
        bondsInitial: inputs.bondsInitial,
        bondAnnualIncrease: inputs.bondAnnualIncrease,
        bondRate: inputs.bondRate
      },
      expenses: {
        monthly: { ...expenses },
        oneTime: showOneTime ? { ...oneTimeExpenses } : {}
      },
      results: {
        currentWealth: results.summary.startWealth,
        projectedRetirement: results.summary.finalWealth,
        fireNumber: fireNumberLakhs,
        yearsToFI,
        progressToFire
      },
      planningParams: {
        startYear: inputs.startYear,
        retirementYear: inputs.retirementYear,
        returnYear: inputs.returnYear,
        withdraw401kYear: inputs.withdraw401kYear,
        applyTax: inputs.applyTax,
        fireMultiplier: inputs.fireMultiplier
      }
    };

    setSnapshots((prev) => [snapshot, ...prev]);
    setShowSaveModal(false);
    setSnapshotLabel('');
    setSnapshotNotes('');
    setSnapshotTags([]);
  };

  const deleteSnapshot = (modelId: string) => {
    if (!window.confirm('Delete this snapshot?')) {
      return;
    }

    setSnapshots((prev) => prev.filter((snapshot) => snapshot.modelId !== modelId));
    setSelectedSnapshots((prev) => prev.filter((id) => id !== modelId));
  };

  const clearAllSnapshots = () => {
    if (!window.confirm(`Delete all ${snapshots.length} snapshots? This cannot be undone!`)) {
      return;
    }

    setSnapshots([]);
    setSelectedSnapshots([]);
    window.localStorage.removeItem('fire-snapshots');
  };

  const toggleSnapshotSelection = (modelId: string) => {
    setSelectedSnapshots((prev) => prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]);
  };

  const loadSnapshot = async (modelId: string) => {
    const snapshot = snapshots.find((item) => item.modelId === modelId);
    if (!snapshot) {
      return;
    }

    const nextOneTimeExpenses = { ...initialOneTimeExpenses, ...snapshot.expenses.oneTime };

    setInputs((prev) => ({
      ...prev,
      ...snapshot.assets,
      ...snapshot.flows,
      ...snapshot.growthRates,
      ...snapshot.bonds,
      ...snapshot.planningParams
    }));
    setExpenses(snapshot.expenses.monthly);
    setOneTimeExpenses(nextOneTimeExpenses);
    setShowOneTime(Object.keys(snapshot.expenses.oneTime).length > 0);

    await runCalculation({
      ...snapshot.assets,
      ...snapshot.flows,
      ...snapshot.growthRates,
      ...snapshot.bonds,
      ...snapshot.planningParams,
      monthlyExpenses: sumExpenses(snapshot.expenses.monthly),
      oneTimeExpenseTotal: sumExpenses(nextOneTimeExpenses)
    });
  };

  const exportSnapshots = () => {
    const blob = new Blob([
      JSON.stringify({ version: '1.0', exportDate: new Date().toISOString(), snapshots }, null, 2)
    ], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `FIRE-Snapshots-${new Date().toISOString().split('T')[0]}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importSnapshots = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const data = JSON.parse(String(loadEvent.target?.result ?? '{}')) as { version?: string; snapshots?: Snapshot[] };
        if (!data.version || !data.snapshots) {
          window.alert('Invalid snapshot file format');
          return;
        }

        const existingIds = new Set(snapshots.map((snapshot) => snapshot.modelId));
        const newSnapshots = data.snapshots.filter((snapshot) => !existingIds.has(snapshot.modelId));
        const duplicates = data.snapshots.length - newSnapshots.length;

        if (newSnapshots.length > 0) {
          setSnapshots((prev) => [...newSnapshots, ...prev]);
        }

        if (duplicates > 0 && newSnapshots.length > 0) {
          window.alert(`Imported ${newSnapshots.length} new snapshots. ${duplicates} duplicate(s) skipped.`);
        } else if (duplicates > 0) {
          window.alert(`All ${duplicates} snapshot(s) already exist. No new snapshots imported.`);
        } else {
          window.alert(`Successfully imported ${newSnapshots.length} snapshot(s)!`);
        }
      } catch (error) {
        window.alert(`Failed to import: ${(error as Error).message}`);
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return {
    snapshots,
    selectedSnapshots,
    showSaveModal,
    snapshotLabel,
    snapshotNotes,
    snapshotTags,
    setShowSaveModal,
    setSnapshotLabel,
    setSnapshotNotes,
    addTag,
    removeTag,
    saveSnapshot,
    deleteSnapshot,
    clearAllSnapshots,
    toggleSnapshotSelection,
    loadSnapshot,
    exportSnapshots,
    importSnapshots
  };
}