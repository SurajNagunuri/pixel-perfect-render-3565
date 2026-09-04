export type Purpose =
  | "home"
  | "personal"
  | "vehicle"
  | "business"
  | "against_property"
  | "gold"
  | "other";

export type IncomeType = "salaried" | "self_employed" | "informal" | "mixed";

export type Stability = "stable" | "varies_some" | "varies_a_lot";

export type Tenure = "lt1" | "1to3" | "3to5" | "5to10" | "10plus";

export type Savings = "lt1" | "1to3" | "3to6" | "6plus" | "unknown";

export type VariablePct = "0" | "lt10" | "10to25" | "gt25" | "unknown";

export type HighestRate = "lt12" | "12to18" | "18to24" | "24to30" | "gt30" | "unknown";

export type Bounce = "no" | "yes_3m" | "unknown";

export type CreditKnown = "yes" | "no" | "prefer_not";

export type MaritalStatus = "single" | "married" | "prefer_not";

export type DependentCount = "0" | "1" | "2" | "3" | "4plus";

export type ChildCount = "0" | "1" | "2" | "3plus";

export type YesNoUnknown = "yes" | "no" | "unknown";

export type SpouseContributes = "regular" | "sometimes" | "no" | "prefer_not";

export type SpouseShare = "most" | "half" | "smaller" | "unsure";

/** Household expense categories, asked one screen at a time. */
export interface ExpenseBreakdown {
  housing: number | null;
  food: number | null;
  utilities: number | null;
  transport: number | null;
  education: number | null;
  medical: number | null;
  dependentSupport: number | null;
  other: number | null;
}

export type ExpenseCategory = keyof ExpenseBreakdown;

export interface Answers {
  purpose: Purpose | null;
  amount: number | null;
  incomeType: IncomeType | null;
  monthlyIncome: number | null;
  incomeStability: Stability | null;
  existingEmi: number | null; // 0 allowed, null = unknown
  /** Legacy single-figure household spend; used only when the breakdown is untouched. */
  householdExpenses: number | null;
  expenses: ExpenseBreakdown;
  age: number | null;

  // household shape
  maritalStatus: MaritalStatus | null;
  numberOfDependents: DependentCount | null;
  childrenCount: ChildCount | null;
  childrenMonthlyExpenses: number | null;

  // insurance & protection
  hasInsurance: YesNoUnknown | null;
  insuranceHealth: number | null;
  insuranceLife: number | null;
  insuranceOther: number | null;

  // spouse contribution
  spouseContributes: SpouseContributes | null;
  spouseIncome: number | null;
  spouseReliableContribution: SpouseShare | null;

  // other recurring obligations
  hasCardDebt: boolean | null;
  cardDebtMonthly: number | null;
  hasOtherCommitments: boolean | null;
  otherFixedCommitments: number | null;
  creditKnown: CreditKnown | null;
  creditScore: number | null;

  // salaried / mixed
  employmentTenure: Tenure | null;
  variableIncomePct: VariablePct | null;

  // self-employed
  businessVintage: Tenure | null;
  documentedAnnualIncome: number | null;
  hasCollateral: boolean | null;
  collateralValue: number | null;

  // informal
  highCostDebt: boolean | null;
  recentBounce: Bounce | null;

  // shared
  emergencySavings: Savings | null;

  // existing debt detail (only if existingEmi > 0)
  activeLoans: number | null;
  outstandingPrincipal: number | null;
  highestExistingRate: HighestRate | null;

  // offer received
  hasOffer: boolean | null;
  offerRate: number | null;
  offerFee: number | null;
  offerTenureMonths: number | null;
  offerAmount: number | null;
}

export type Verdict = "BORROW" | "BORROW_LESS" | "DONT_BORROW";
export type Confidence = "High" | "Medium" | "Low";

export interface Band {
  low: number;
  high: number;
}

export interface Explained<T> {
  value: T;
  reason: string;
}

export interface TenureRow {
  months: number;
  emi: number;
  totalInterest: number;
  totalRepayment: number;
}

export interface Assessment {
  verdict: Explained<Verdict>;
  safeEmi: Explained<number>;
  lenderEmi: Explained<number>;
  safeAmount: Explained<Band>;
  lenderAmount: Explained<Band>;
  fairRate: Explained<Band>;
  apr: Explained<Band>;
  requestedEmi: number;
  tenureTable: TenureRow[];
  assumedTenureMonths: number;
  /** Set when age forced a shorter tenure than the product default. */
  tenureNote: string | null;
  upfrontFee: number;
  netDisbursed: number;
  feeIsQuoted: boolean;
  /** Income the assessment actually used (capped at documented income where relevant). */
  assessedMonthlyIncome: number;
  existingEmiKnown: boolean;

  stress: {
    kind: "income" | "rate";
    emi: number;
    foir: number;
    safeFoirTarget: number;
    note: string;
  };
  foirNow: number;
  reasons: string[];
  nextSteps: string[];
  confidence: {
    overall: Confidence;
    rate: Confidence;
    amount: Confidence;
    notes: string[];
  };
  offerComparison: {
    rate: number;
    feeRupees: number;
    netDisbursed: number;
    apr: number;
    verdict: string;
  } | null;
  secured: string | null;
  documentedMonthlyIncome: number | null;
}
