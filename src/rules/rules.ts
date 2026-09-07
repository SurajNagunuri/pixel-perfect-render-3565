import type { HighestRate, IncomeType, Purpose, Savings, Stability } from "@/types";

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
  /** A missed payment older than 3 months still matters, just less. */
  olderBounce: 0.1,
  lowSavings: 0.1,
  highCostDebt: 0.15,
  /** A revolving card / app-loan balance, separate from its monthly payment. */
  revolvingBalance: 0.1,
  stretchedHousehold: 0.15,
};

/**
 * Missed-payment rules. A recent miss is the strongest single signal we hold, and
 * repeated misses compound it. "I'm not sure" widens confidence instead of penalising.
 */
export const RECENT_BOUNCE_RULES = {
  recentMonths: 3,
  recentHaircut: SAFETY_HAIRCUTS.recentBounce,
  olderHaircut: SAFETY_HAIRCUTS.olderBounce,
  /** Extra haircut per additional miss beyond the first, in the last 12 months. */
  perAdditionalMissHaircut: 0.05,
  maxAdditionalHaircut: 0.15,
  recentRateShift: RATE_ADJUSTMENTS.recentBounceShift,
  olderRateShift: 1,
  type: "my judgement" as const,
};

/**
 * Expensive existing debt. Clearing it frees more room than a new loan creates, so
 * we both price it in and say so.
 */
export const HIGH_COST_DEBT_RULES = {
  rateThreshold: 24,
  haircut: SAFETY_HAIRCUTS.highCostDebt,
  rateShift: RATE_ADJUSTMENTS.highCostDebtShift,
  /** Revolving balance above this multiple of monthly income is treated as heavy. */
  heavyBalanceMonthsOfIncome: 1,
  type: "my judgement" as const,
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

/* ---------------------------------------------------------------------------
 * Assumptions that used to live inline in the calculation engine.
 * Everything the engine treats as a judgement call must be a named value here.
 * ------------------------------------------------------------------------- */

/** How much of the income we can actually assess, by income type / documentation. */
export const INCOME_ASSESSMENT = {
  /** Self-employed with no ITR / documented income at all. */
  undocumentedSelfEmployedFactor: 0.6,
  /** Cash / gig income — a bad month is normal, so we don't assess the peak. */
  informalFactor: 0.85,
  /** Salaried where more than 25% of pay is variable/incentive-based. */
  highVariablePayFactor: 0.85,
};

export const HOUSEHOLD = {
  /** Share of leftover household cash (after expenses and existing EMIs) a new EMI may use. */
  maxShareOfLeftoverCash: 0.7,
  /** Expenses above this share of household income trigger a safety haircut. */
  stretchedExpenseRatio: 0.6,
};

/**
 * Cash-flow capacity: after every recurring household commitment, only part of the
 * remaining money should ever go to a new EMI. This is the borrower-safety buffer.
 */
export const CASH_FLOW_BUFFER = {
  value: 0.6,
  reason:
    "A new EMI should never consume all of your free cash flow — we leave at least 40% of it for irregular costs, festivals, repairs and medical bills.",
  type: "my judgement" as const,
};

/** Only income that reliably reaches the household counts toward repayment. */
export const SPOUSE_CONTRIBUTION = {
  /** How dependable the spouse's earning itself is. */
  regularity: { regular: 1, sometimes: 0.6, no: 0, prefer_not: 0 },
  /** How much of that income actually funds household costs and repayment. */
  share: { most: 0.75, half: 0.5, smaller: 0.25, unsure: 0.25 },
  reason:
    "We never count 100% of a spouse's income. We count the part that reliably reaches the household, and uncertain contribution widens confidence instead of raising capacity.",
  type: "my judgement" as const,
};

/**
 * Emergency savings moderate the safe EMI — a thin cushion is what turns a tight
 * month into a missed EMI. Borrower-safety judgement, not a regulatory rule.
 */
export const EMERGENCY_BUFFER_ADJUSTMENTS: Record<
  Savings,
  { haircut: number; note: string; confidence: "raise" | "neutral" | "widen" }
> = {
  lt1: {
    haircut: 0.1,
    note: "under 1 month of essential expenses saved",
    confidence: "neutral",
  },
  "1to3": { haircut: 0.05, note: "1–3 months of expenses saved", confidence: "neutral" },
  "3to6": { haircut: 0, note: "3–6 months of expenses saved", confidence: "neutral" },
  "6plus": { haircut: 0, note: "6+ months of expenses saved", confidence: "raise" },
  unknown: { haircut: 0, note: "savings cushion unknown", confidence: "widen" },
};

/** Income steadiness moderates the cash-flow buffer as well as confidence. */
export const INCOME_STABILITY_ADJUSTMENTS: Record<
  Stability,
  { haircut: number; note: string }
> = {
  stable: { haircut: 0, note: "steady monthly income" },
  varies_some: { haircut: 0.05, note: "income varies a little month to month" },
  varies_a_lot: { haircut: 0.15, note: "income varies a lot month to month" },
};

/**
 * Unknown is never zero. When a recurring commitment is unknown we hold back a
 * small, clearly-labelled allowance instead of pretending it does not exist.
 */
export const UNKNOWN_ALLOWANCES = {
  insuranceShareOfIncome: 0.02,
  expenseCategoryShareOfIncome: 0.03,
  reason:
    "Where you skipped a recurring cost we hold back a small allowance rather than assume zero, and we say so.",
  type: "my judgement" as const,
};

export const EXPENSE_LABELS = {
  housing: "Housing / rent",
  food: "Food and groceries",
  utilities: "Utilities",
  transport: "Transport",
  education: "Education / childcare",
  medical: "Medical / healthcare",
  dependentSupport: "Support for parents / dependents",
  other: "Other regular household expenses",
} as const;

/** Loan-to-value cap a lender is likely to work to against pledged collateral. */
export const COLLATERAL = {
  ltvCap: 0.6,
  /** Collateral above this value routes the assessment to a secured product. */
  minValueToRouteSecured: 100000,
  /** Already mortgaged or pledged — only part of the value is really free. */
  encumberedLtvFactor: 0.5,
  /** Borrower isn't sure whether it carries a loan, so we stay cautious. */
  unknownEncumbranceLtvFactor: 0.75,
  reason:
    "Collateral raises what a lender may sanction. It never raises what your household can afford to repay each month.",
  type: "my judgement" as const,
};


/** A borrower is treated as carrying expensive debt at or above this annual rate. */
export const HIGH_COST_DEBT_RATE_THRESHOLD = 24;

/** Existing-debt-load signals. */
export const DEBT_LOAD = {
  /** Number of simultaneously active loans that counts as stacked borrowing. */
  manyActiveLoans: 3,
  manyActiveLoansHaircut: 0.1,
  manyActiveLoansRateShift: 1,
  /** Outstanding principal above this multiple of monthly income is a heavy load. */
  heavyOutstandingMonthsOfIncome: 6,
  heavyOutstandingHaircut: 0.1,
};

/** Rate-band construction guardrails. */
export const RATE_FLOORS: Record<Purpose, number> = {
  home: 7.5,
  against_property: 8.5,
  personal: 10,
  gold: 8.5,
  vehicle: 9,
  business: 10,
  other: 11,
};

export const RATE_BAND = {
  /** A band narrower than this is false precision, so we widen it. */
  minWidthPoints: 1.5,
};

/** When collateral is pledged, price against this product's band instead of the raw purpose. */
export const SECURED_ROUTE_PURPOSE: Purpose = "against_property";

/** Verdict thresholds. */
export const VERDICT_THRESHOLDS = {
  /** Requested EMI above safe EMI by this multiple counts as "far above" cash flow. */
  farAboveSafeEmiMultiple: 1.6,
  /** Tolerance before we tell someone their ask is above the safer range. */
  amountBandTolerance: 1.05,
  /** Credit score at or above which we call the profile strong. */
  strongCreditScore: 750,
};

/** Rounding step for displayed principal bands, by magnitude. */
export function principalRoundingStep(value: number): number {
  if (value >= 1000000) return 50000;
  if (value >= 200000) return 10000;
  if (value >= 50000) return 5000;
  return 1000;
}

/** Age-based tenure limits: the loan should end before the borrower runs out of earning years. */
export const TENURE_AGE_RULE = {
  /** Salaried borrowers are expected to repay by retirement. */
  salariedEndAge: AGE_LIMITS.retirement,
  /** Self-employed / informal earners can usually run later. */
  otherEndAge: 70,
  minMonths: 12,
};
