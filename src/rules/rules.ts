import type { HighestRate, IncomeType, Purpose } from "@/types";

/**
 * Central configuration. Change a number here and every output updates.
 * These are PROTOTYPE assumptions, not lender policy and not regulation.
 */

export const SAFE_FOIR: Record<IncomeType, number> = {
  salaried: 0.4,
  self_employed: 0.35,
  informal: 0.3,
  mixed: 0.35,
};

export const LENDER_FOIR: Record<IncomeType, number> = {
  salaried: 0.5,
  self_employed: 0.45,
  informal: 0.4,
  mixed: 0.45,
};

/** Indicative market rate bands (annual %, prototype estimates). */
export const RATE_BANDS: Record<Purpose, { low: number; high: number; label: string }> = {
  home: { low: 7.5, high: 9.5, label: "Home loan" },
  against_property: { low: 9, high: 12.5, label: "Loan against property" },
  personal: { low: 10.5, high: 18, label: "Personal loan" },
  gold: { low: 9, high: 15, label: "Gold loan" },
  vehicle: { low: 10, high: 18, label: "Vehicle loan" },
  business: { low: 11, high: 22, label: "Business loan" },
  other: { low: 12, high: 22, label: "Unsecured borrowing" },
};

export const HIGH_RISK_UNSECURED_BAND = { low: 18, high: 30 };

export const RATE_ADJUSTMENTS = {
  creditScore: [
    { min: 780, shift: -1.5, widen: -1, note: "Credit score 780+ (strong repayment record)" },
    { min: 730, shift: -0.75, widen: -0.5, note: "Credit score 730–779 (good record)" },
    { min: 680, shift: 0, widen: 0, note: "Credit score 680–729 (average record)" },
    { min: 620, shift: 1.5, widen: 1, note: "Credit score 620–679 (below average record)" },
    { min: 300, shift: 3, widen: 1.5, note: "Credit score under 620" },
  ],
  unknownScoreWiden: 2.5,
  unstableIncomeShift: 1.25,
  shortTenureShift: 1.5,
  longTenureShift: -0.5,
  collateralShift: -2,
  undocumentedIncomeShift: 1.5,
  recentBounceShift: 3,
  highCostDebtShift: 1.5,
};

export const STRESS_ASSUMPTIONS = {
  incomeDropPct: 0.15,
  rateIncreasePoints: 2,
};

export const FEE_ASSUMPTIONS = {
  /** Assumed processing fee when the borrower has no quote yet. */
  assumedProcessingFeePct: 0.015,
  otherUpfrontChargesPct: 0.002,
};

export const CONFIDENCE_THRESHOLDS = {
  highMinAnswered: 0.85,
  mediumMinAnswered: 0.6,
};

export const DEFAULT_TENURES: Record<Purpose, number> = {
  home: 240,
  against_property: 180,
  personal: 48,
  gold: 24,
  vehicle: 48,
  business: 48,
  other: 48,
};

export const TENURE_OPTIONS: Record<Purpose, number[]> = {
  home: [120, 180, 240, 300],
  against_property: [84, 120, 180, 240],
  personal: [24, 36, 48, 60],
  gold: [12, 18, 24, 36],
  vehicle: [24, 36, 48, 60],
  business: [24, 36, 48, 60],
  other: [24, 36, 48, 60],
};

/** Safe-EMI haircuts applied for fragility signals. */
export const SAFETY_HAIRCUTS = {
  variableIncomeHigh: 0.15,
  incomeVariesALot: 0.15,
  recentBounce: 0.25,
  lowSavings: 0.1,
  highCostDebt: 0.15,
  stretchedHousehold: 0.15,
};

export const HIGHEST_RATE_VALUE: Record<HighestRate, number | null> = {
  lt12: 11,
  "12to18": 15,
  "18to24": 21,
  "24to30": 27,
  gt30: 33,
  unknown: null,
};

export const AGE_LIMITS = { min: 18, max: 75, retirement: 60 };
export const CREDIT_SCORE_RANGE = { min: 300, max: 900 };
