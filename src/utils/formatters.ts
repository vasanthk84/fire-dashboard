import type { Milestone } from '../types';

export function fmtL(value: number): string {
  if (!Number.isFinite(value)) {
    return '₹0.0L';
  }
  return value >= 100 ? `₹${(value / 100).toFixed(2)}Cr` : `₹${value.toFixed(1)}L`;
}

export function fmtRupees(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

export function milestoneClass(type: Milestone['type']): string {
  return `milestone-tag ${type}`;
}
