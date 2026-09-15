/**
 * Portfolio Health Score — a single 0-100 number blending four things this app
 * already knows about your tracked funds: diversification, plan cost
 * efficiency (Direct vs Regular), concentration risk, and performance vs
 * category benchmark. Deliberately built from data already in the CAS import
 * / manual tracker — no external fund database, no assumed expense-ratio
 * figures (those aren't in a CAS, so insights about Regular plans are
 * qualitative, not "you're losing ₹X/yr" claims we can't actually verify).
 *
 * Closed (fully redeemed) funds are excluded — a health score is about what
 * you're currently holding, not what you used to hold.
 */
import type { MFCategory, MFFundMetrics } from '../types';
import { fmtRupees } from './formatters';

export interface MFHealthComponent {
  key: string;
  label: string;
  score: number; // 0-100
  weight: number; // fraction of the overall score this component contributes (post-reweight)
  detail: string;
}

export type MFHealthGrade = 'Excellent' | 'Good' | 'Fair' | 'Needs attention';

export interface MFHealthInsight {
  text: string;
  tone: 'warn' | 'ok';
}

export interface MFHealthResult {
  score: number | null; // 0-100, null when there's nothing active to score
  grade: MFHealthGrade | null;
  components: MFHealthComponent[];
  insights: MFHealthInsight[];
}

const TIER_SCORE: Record<1 | 2 | 3, number> = { 1: 100, 2: 60, 3: 20 };

function gradeFor(score: number): MFHealthGrade {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 45) return 'Fair';
  return 'Needs attention';
}

export function computeHealthScore(metrics: MFFundMetrics[]): MFHealthResult {
  const active = metrics.filter((m) => !m.closed && m.fund.currentValue > 0);
  const totalValue = active.reduce((s, m) => s + m.fund.currentValue, 0);

  if (active.length === 0 || totalValue <= 0) {
    return { score: null, grade: null, components: [], insights: [{ text: 'Add active fund holdings to compute a health score.', tone: 'warn' }] };
  }

  const insights: MFHealthInsight[] = [];
  const components: MFHealthComponent[] = [];

  // 1. Diversification — Herfindahl-Hirschman Index across categories,
  // value-weighted. HHI=1 means everything in one category (score 0); spread
  // evenly across many categories pushes HHI toward 0 (score toward 100).
  const byCategory = new Map<MFCategory, number>();
  for (const m of active) {
    byCategory.set(m.fund.category, (byCategory.get(m.fund.category) ?? 0) + m.fund.currentValue);
  }
  const hhi = [...byCategory.values()].reduce((s, v) => s + (v / totalValue) ** 2, 0);
  const diversificationScore = Math.max(0, Math.min(100, 100 * (1 - hhi)));
  components.push({
    key: 'diversification',
    label: 'Diversification',
    score: diversificationScore,
    weight: 0.3,
    detail: `Spread across ${byCategory.size} categor${byCategory.size === 1 ? 'y' : 'ies'}`
  });
  if (diversificationScore < 55) {
    insights.push({
      text: byCategory.size <= 2
        ? `Your active holdings sit in just ${byCategory.size} categor${byCategory.size === 1 ? 'y' : 'ies'} — spreading across more fund categories usually reduces concentration risk.`
        : `Spread across ${byCategory.size} categories on paper, but the money is concentrated in just a few of them — true diversification is lower than the category count suggests.`,
      tone: 'warn'
    });
  }

  // 2. Plan cost efficiency — value share sitting in Direct plans. No claim
  // about the actual expense-ratio gap (not in a CAS) — just the flag itself.
  const directValue = active.filter((m) => m.fund.plan === 'direct').reduce((s, m) => s + m.fund.currentValue, 0);
  const regularValue = totalValue - directValue;
  const costScore = (directValue / totalValue) * 100;
  components.push({
    key: 'cost',
    label: 'Plan efficiency',
    score: costScore,
    weight: 0.2,
    detail: `${costScore.toFixed(0)}% in Direct plans`
  });
  if (regularValue > 0) {
    insights.push({
      text: `${fmtRupees(regularValue)} is in Regular plans — these typically carry a higher expense ratio than the same scheme's Direct plan (not in your CAS, so check the fund's factsheet). Look for a Direct twin.`,
      tone: 'warn'
    });
  }

  // 3. Concentration risk — heaviest single fund as a share of active value.
  // Below 20% incurs no penalty; the score falls off past that.
  const heaviest = active.reduce((a, b) => (a.fund.currentValue > b.fund.currentValue ? a : b));
  const topFundWeightPct = (heaviest.fund.currentValue / totalValue) * 100;
  const concentrationScore = Math.max(0, Math.min(100, 100 - Math.max(0, topFundWeightPct - 20) * 2.5));
  components.push({
    key: 'concentration',
    label: 'Concentration risk',
    score: concentrationScore,
    weight: 0.2,
    detail: `Largest single fund: ${topFundWeightPct.toFixed(0)}% of tracked value`
  });
  if (topFundWeightPct > 30) {
    insights.push({
      text: `${heaviest.fund.name} alone makes up ${topFundWeightPct.toFixed(0)}% of your active holdings — a single-fund shock would hit hard. Consider trimming concentration here.`,
      tone: 'warn'
    });
  }

  // 4. Performance vs benchmark — value-weighted tier mix, only among funds
  // that actually have a tier (excludes too-young / absolute-return-only
  // funds, which aren't ranked against the benchmark). Skipped entirely (and
  // the other three reweighted to fill the gap) when nothing is tiered yet.
  const tiered = active.filter((m) => m.tier !== null);
  const tieredValue = tiered.reduce((s, m) => s + m.fund.currentValue, 0);
  if (tiered.length > 0 && tieredValue > 0) {
    const tierScore = tiered.reduce((s, m) => s + (TIER_SCORE[m.tier as 1 | 2 | 3] * m.fund.currentValue) / tieredValue, 0);
    components.push({
      key: 'performance',
      label: 'Performance vs benchmark',
      score: tierScore,
      weight: 0.3,
      detail: `${tiered.filter((m) => m.tier === 3).length} of ${tiered.length} tiered fund${tiered.length === 1 ? '' : 's'} lagging benchmark`
    });
    const tier3Value = tiered.filter((m) => m.tier === 3).reduce((s, m) => s + m.fund.currentValue, 0);
    if (tier3Value / totalValue > 0.15) {
      insights.push({
        text: `${((tier3Value / totalValue) * 100).toFixed(0)}% of your tracked value is in funds tiered "Reduce" — behind their category benchmark by more than your tier threshold.`,
        tone: 'warn'
      });
    }
  }

  const weightSum = components.reduce((s, c) => s + c.weight, 0);
  const score = weightSum > 0 ? components.reduce((s, c) => s + (c.score * c.weight) / weightSum, 0) : 50;

  if (insights.length === 0) {
    insights.push({
      text: 'No major red flags in what you’re tracking — diversification, plan mix, concentration, and performance all look reasonable.',
      tone: 'ok'
    });
  }

  return { score, grade: gradeFor(score), components, insights };
}
