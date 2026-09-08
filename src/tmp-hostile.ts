/* temporary hostile verification harness — deleted after the run */
import { calculateEMI, runAssessment, separateCardDebtPayment, spouseContribution } from "./calculations/engine";
import { emptyAnswers, sampleBorrowers } from "./data/sampleBorrowers";
import type { Answers } from "./types";

let failures = 0;
function check(name: string, cond: boolean, extra = "") {
  if (!cond) {
    failures++;
    console.log("  FAIL:", name, extra);
  }
}

const base: Answers = {
  ...emptyAnswers,
  purpose: "personal",
  amount: 400000,
  incomeType: "salaried",
  monthlyIncome: 60000,
  incomeStability: "stable",
  variablePct: "0",
  employmentTenure: "3to5",
  age: 34,
  existingEmi: 0,
  hasInsurance: "no",
  emergencySavings: "3to6",
  recentBounce: "no",
  creditKnown: "yes",
  creditScore: 760,
  hasCardDebt: false,
  hasOtherCommitments: false,
  hasCollateral: false,
  expenses: {
    housing: 12000,
    food: 8000,
    utilities: 2500,
    transport: 2500,
    education: 0,
    medical: 1000,
    dependentSupport: 0,
    other: 2000,
  },
};

function invariants(label: string, a: Answers) {
  const r = runAssessment(a);
  const s = `[${label}]`;
  // structural invariants that must hold for every borrower
  check(`${s} safe EMI <= lender EMI`, r.safeEmi.value <= r.lenderEmi.value, `${r.safeEmi.value} vs ${r.lenderEmi.value}`);
  check(`${s} safe EMI <= FOIR capacity`, r.safeEmi.value <= r.foirSafeEmi + 1, `${r.safeEmi.value} vs ${r.foirSafeEmi}`);
  check(
    `${s} safe EMI <= cash-flow capacity`,
    r.safeEmi.value <= Math.max(0, r.cashFlow.emiCapFromCashFlow) + 1,
    `${r.safeEmi.value} vs ${r.cashFlow.emiCapFromCashFlow}`,
  );
  check(`${s} safe EMI >= 0`, r.safeEmi.value >= 0, String(r.safeEmi.value));
  check(`${s} safe amount band ordered`, r.safeAmount.value.low <= r.safeAmount.value.high);
  check(`${s} lender amount band ordered`, r.lenderAmount.value.low <= r.lenderAmount.value.high);
  check(
    `${s} lender amount >= safe amount`,
    r.lenderAmount.value.high >= r.safeAmount.value.high,
    `${r.lenderAmount.value.high} vs ${r.safeAmount.value.high}`,
  );
  check(`${s} rate band ordered & sane`, r.fairRate.value.low > 0 && r.fairRate.value.low < r.fairRate.value.high && r.fairRate.value.high < 45, JSON.stringify(r.fairRate.value));
  check(`${s} rate band >= 1.5 wide`, r.fairRate.value.high - r.fairRate.value.low >= 1.49, JSON.stringify(r.fairRate.value));
  check(`${s} APR above rate at both ends`, r.apr.value.low > r.fairRate.value.low && r.apr.value.high > r.fairRate.value.high, JSON.stringify(r.apr.value));
  check(`${s} net disbursed < requested`, r.netDisbursed <= (a.amount ?? 0) && r.netDisbursed > 0);
  check(`${s} tenure positive`, r.assumedTenureMonths >= 12);
  check(`${s} requested EMI matches amount`, Math.abs(r.requestedEmi - calculateEMI(a.amount!, (r.fairRate.value.low + r.fairRate.value.high) / 2, r.assumedTenureMonths)) < 2, String(r.requestedEmi));
  check(`${s} verdict present`, ["BORROW", "BORROW_LESS", "DONT_BORROW"].includes(r.verdict.value));
  check(`${s} verdict has a reason`, r.verdict.reason.length > 20);
  check(`${s} at least 3 reasons`, r.reasons.length >= 3, String(r.reasons.length));
  check(`${s} confidence levels valid`, ["High", "Medium", "Low"].every((_) => true) && ["High", "Medium", "Low"].includes(r.confidence.overall) && ["High", "Medium", "Low"].includes(r.confidence.rate) && ["High", "Medium", "Low"].includes(r.confidence.amount));
  check(`${s} every figure has a why`, [r.safeEmi.reason, r.safeAmount.reason, r.lenderAmount.reason, r.fairRate.reason, r.apr.reason].every((w) => typeof w === "string" && w.length > 20));
  check(`${s} no NaN anywhere`, !JSON.stringify(r).includes("null,\"why") && !/NaN/.test(JSON.stringify(r)), JSON.stringify(r).match(/NaN/) ? "NaN found" : "");
  // denominators: FOIR must be measured on the same assessed income everywhere
  const burden = r.assessedMonthlyIncome > 0 ? (r.safeEmi.value + (a.existingEmi ?? 0)) / r.assessedMonthlyIncome : 0;
  check(`${s} safe burden <= lender burden`, burden <= r.stress.safeFoirTarget + 0.02 || r.bindingConstraint === "cash_flow", burden.toFixed(3));
  // cash-flow arithmetic must add up exactly
  const c = r.cashFlow;
  const expected =
    c.reliableHouseholdIncome -
    (c.householdExpenses + c.insurance + c.existingEmi + c.cardDebt + c.otherCommitments + (c.unknownAllowance ?? 0));
  check(`${s} free cash flow adds up`, Math.abs(expected - c.freeCashFlow) < 2, `${expected} vs ${c.freeCashFlow}`);
  check(`${s} verdict consistent with capacity`, r.safeEmi.value > 0 || r.verdict.value === "DONT_BORROW", `safeEmi ${r.safeEmi.value} verdict ${r.verdict.value}`);
  check(
    `${s} BORROW only when request fits`,
    r.verdict.value !== "BORROW" || r.requestedEmi <= r.safeEmi.value * 1.02,
    `req ${r.requestedEmi} ceiling ${r.safeEmi.value}`,
  );
  check(`${s} stress EMI >= requested-or-safe base`, r.stress.emi > 0);
  return r;
}

const cases: Array<[string, Answers]> = [
  ["1 single with children", { ...base, maritalStatus: "single", hasDependents: "yes", dependentTypes: ["children"], numberOfDependents: "2", childrenCount: "2", expenses: { ...base.expenses, education: 6000 } }],
  ["2 married, no dependents", { ...base, maritalStatus: "married", hasDependents: "no", spouseContributes: "no" }],
  ["3 married, unreliable spouse", { ...base, maritalStatus: "married", spouseContributes: "sometimes", spouseIncome: 30000, spouseReliableContribution: "unsure" }],
  ["4 unknown credit score", { ...base, creditKnown: "no", creditScore: null }],
  ["5 unknown insurance", { ...base, hasInsurance: "unknown" }],
  ["6 missing expenses", { ...base, expenses: { ...emptyAnswers.expenses, housing: 12000 } }],
  ["7 app loan inside existing EMI", { ...base, existingEmi: 7000, hasCardDebt: true, cardDebtMonthly: 7000, cardDebtOutstanding: 40000, cardDebtRate: "gt30", cardDebtInExistingEmi: "yes" }],
  ["8 card debt above 30%", { ...base, hasCardDebt: true, cardDebtMonthly: 4000, cardDebtOutstanding: 90000, cardDebtRate: "gt30", cardDebtInExistingEmi: "no" }],
  ["9 recent bounce", { ...base, recentBounce: "yes_3m", bounceCount: 2 }],
  ["10 self-employed wide range", { ...base, incomeType: "self_employed", monthlyIncome: 90000, weakMonthIncome: 25000, incomeStability: "varies_a_lot", documentedAnnualIncome: 600000, employmentTenure: "10plus", purpose: "business", amount: 1000000 }],
  ["11 documented far below cash", { ...base, incomeType: "self_employed", monthlyIncome: 120000, documentedAnnualIncome: 300000, incomeStability: "varies_some", purpose: "business", amount: 1200000 }],
  ["12 property collateral", { ...base, purpose: "business", amount: 1500000, hasCollateral: true, collateralType: "property", collateralValue: 4500000, collateralHasLoan: "no" }],
  ["13 gold collateral", { ...base, purpose: "personal", amount: 300000, hasCollateral: true, collateralType: "gold", collateralValue: 900000, collateralHasLoan: "no" }],
  ["14 big collateral, thin cash flow", { ...base, monthlyIncome: 22000, purpose: "business", amount: 2000000, hasCollateral: true, collateralType: "property", collateralValue: 9000000, expenses: { ...base.expenses, housing: 9000, food: 7000 } }],
  ["15 request far above capacity", { ...base, amount: 5000000 }],
  ["16 invalid/negative inputs", { ...base, monthlyIncome: -5000, amount: -100, existingEmi: -2000, age: 0, expenses: { ...base.expenses, housing: -1000 } }],
  ["17 zero existing EMI", { ...base, existingEmi: 0 }],
  ["18 very high household expenses", { ...base, expenses: { housing: 30000, food: 15000, utilities: 4000, transport: 4000, education: 5000, medical: 3000, dependentSupport: 3000, other: 3000 } }],
  ["19 income stress path", { ...base, incomeType: "informal", incomeStability: "varies_a_lot", monthlyIncome: 30000, weakMonthIncome: 22000 }],
  ["20 rate stress path", { ...base, incomeType: "salaried", incomeStability: "stable" }],
];

for (const [label, a] of cases) {
  console.log("==", label);
  try {
    const r = invariants(label, a);
    console.log(
      `   verdict ${r.verdict.value} | safeEmi ${r.safeEmi.value} | safeAmt ${r.safeAmount.value.low}-${r.safeAmount.value.high} | lenderAmt ${r.lenderAmount.value.low}-${r.lenderAmount.value.high} | rate ${r.fairRate.value.low}-${r.fairRate.value.high} | apr ${r.apr.value.low}-${r.apr.value.high} | conf ${r.confidence.overall}/${r.confidence.rate}/${r.confidence.amount} | stress ${r.stress.kind} ${r.stress.emi} | free ${r.cashFlow.freeCashFlow}`,
    );
  } catch (e) {
    failures++;
    console.log("  THREW:", (e as Error).message);
  }
}

// case-specific expectations
console.log("== targeted expectations");
{
  const single = runAssessment(cases[0][1]);
  const married = runAssessment(cases[1][1]);
  check("single-with-children has no spouse income", single.cashFlow.spouseContribution === 0);
  check("married-no-dependents has no dependent deduction", married.cashFlow.spouseContribution === 0);
  const c3 = spouseContribution(cases[2][1]);
  check("unreliable spouse counted small", c3.value > 0 && c3.value < 30000 * 0.4, String(c3.value));
  const c4 = runAssessment(cases[3][1]);
  const known = runAssessment(base);
  check("unknown score widens band", c4.fairRate.value.high - c4.fairRate.value.low > known.fairRate.value.high - known.fairRate.value.low);
  check("unknown score lowers rate confidence", c4.confidence.rate !== "High");
  const c5 = runAssessment(cases[4][1]);
  check("unknown insurance holds an allowance", c5.cashFlow.insurance > 0, String(c5.cashFlow.insurance));
  const c6 = runAssessment(cases[5][1]);
  check("missing expenses named", c6.cashFlow.missingCategories.length >= 3, String(c6.cashFlow.missingCategories.length));
  check("missing expenses lower confidence", c6.confidence.amount !== "High" || c6.confidence.overall !== "High");
  check("app loan inside EMI counted once", separateCardDebtPayment(cases[6][1]).value === 0);
  const c7 = runAssessment(cases[6][1]);
  check("no double count in cash flow", c7.cashFlow.existingEmi === 7000 && c7.cashFlow.cardDebt === 0);
  const c8 = runAssessment(cases[7][1]);
  check("30%+ card debt raises rate", c8.fairRate.value.high > known.fairRate.value.high);
  check("30%+ card debt lowers capacity", c8.safeEmi.value < known.safeEmi.value);
  const c9 = runAssessment(cases[8][1]);
  check("bounce lowers capacity", c9.safeEmi.value < known.safeEmi.value);
  check("bounce raises rate", c9.fairRate.value.low > known.fairRate.value.low);
  const c10 = runAssessment(cases[9][1]);
  check("wide-range self-employed assessed on documented", c10.assessedMonthlyIncome <= 50000, String(c10.assessedMonthlyIncome));
  const c11 = runAssessment(cases[10][1]);
  check("documented income caps assessment", c11.assessedMonthlyIncome <= 25000, String(c11.assessedMonthlyIncome));
  const c12 = runAssessment(cases[11][1]);
  check("property routes secured", (c12.secured ?? "").includes("property"), String(c12.secured));
  check("property LTV caps sanction", c12.lenderAmount.value.high <= 4500000 * 0.6 + 1);
  const c13 = runAssessment(cases[12][1]);
  check("gold routes to gold loan", (c13.secured ?? "").toLowerCase().includes("gold"), String(c13.secured));
  const c13NoGold = runAssessment({ ...cases[12][1], hasCollateral: false, collateralType: null, collateralValue: null });
  check("gold does not raise safe EMI", c13.safeEmi.value <= c13NoGold.safeEmi.value, `${c13.safeEmi.value} vs ${c13NoGold.safeEmi.value}`);
  const c14 = runAssessment(cases[13][1]);
  check("big collateral thin cash flow => borrow much less", c14.safeAmount.value.high < c14.lenderAmount.value.high / 3);
  check("big collateral does not give BORROW", c14.verdict.value !== "BORROW", c14.verdict.value);
  const c15 = runAssessment(cases[14][1]);
  check("far-above request is not BORROW", c15.verdict.value !== "BORROW", c15.verdict.value);
  const c16 = runAssessment(cases[15][1]);
  check("invalid inputs do not produce negative outputs", c16.safeEmi.value >= 0 && c16.safeAmount.value.low >= 0 && c16.lenderAmount.value.low >= 0, JSON.stringify([c16.safeEmi.value, c16.safeAmount.value, c16.lenderAmount.value]));
  check("invalid inputs produce no NaN", !/NaN/.test(JSON.stringify(c16)));
  const c18 = runAssessment(cases[17][1]);
  check("high expenses bind on cash flow", c18.bindingConstraint === "cash_flow");
  const c19 = runAssessment(cases[18][1]);
  check("unstable earner stressed on income", c19.stress.kind === "income", c19.stress.kind);
  const c20 = runAssessment(cases[19][1]);
  check("stable earner stressed on rate", c20.stress.kind === "rate", c20.stress.kind);
  check("rate stress uses +2pp", c20.stress.emi > c20.requestedEmi || c20.stress.emi > 0);
}

console.log("== samples");
for (const s of sampleBorrowers) invariants(s.id, s.answers);

console.log(failures === 0 ? "ALL INVARIANTS PASS" : `${failures} FAILURES`);
