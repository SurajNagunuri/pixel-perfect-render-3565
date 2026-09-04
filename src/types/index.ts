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

export interface Answers {
  purpose: Purpose | null;
  amount: number | null;
  incomeType: IncomeType | null;
  monthlyIncome: number | null;
  incomeStability: Stability | null;
  existingEmi: number | null; // 0 allowed, null = unknown
  householdExpenses: number | null;
  age: number | null;
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
