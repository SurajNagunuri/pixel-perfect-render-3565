import { describe, expect, it } from "vitest";

import {
  calculateAffordability,
  calculateEMI,
  hasExpensiveExistingDebt,
  highCostDebtSignal,
  principalFromEMI,
  runAssessment,
  securedProductPurpose,
  separateCardDebtPayment,
  spouseContribution,
} from "./engine";
import { emptyAnswers, sampleBorrowers } from "@/data/sampleBorrowers";
import type { Answers } from "@/types";

const sample = (id: "priya" | "ravi" | "anita"): Answers =>
  structuredClone(sampleBorrowers.find((s) => s.id === id)!.answers);

describe("money math", () => {
  it("EMI and reverse EMI are inverses", () => {
    const emi = calculateEMI(1000000, 12, 60);
    expect(Math.round(principalFromEMI(emi, 12, 60))).toBeCloseTo(1000000, -1);
  });
  it("a zero-rate loan is simple division", () => {
    expect(calculateEMI(120000, 0, 12)).toBe(10000);
  });
});

describe("high-cost debt is one canonical definition", () => {
  it("picks up a card rate even when the explicit answer is no", () => {
    const a: Answers = { ...emptyAnswers, highCostDebt: false, cardDebtRate: "gt30" };
    expect(highCostDebtSignal(a).present).toBe(true);
  });
  it("picks up an existing loan rate", () => {
    expect(hasExpensiveExistingDebt({ ...emptyAnswers, highestExistingRate: "24to30" })).toBe(true);
  });
  it("a later unknown never erases an established signal", () => {
    const a: Answers = { ...emptyAnswers, highCostDebt: true, cardDebtRate: "unknown" };
    expect(hasExpensiveExistingDebt(a)).toBe(true);
  });
  it("cheap debt is not high cost", () => {
    expect(hasExpensiveExistingDebt({ ...emptyAnswers, highestExistingRate: "lt12" })).toBe(false);
  });
});

describe("no double counting of debt", () => {
  const base: Answers = {
    ...emptyAnswers,
    purpose: "vehicle",
    amount: 150000,
    incomeType: "salaried",
    monthlyIncome: 50000,
    incomeStability: "stable",
    age: 35,
    existingEmi: 6000,
    hasCardDebt: true,
    cardDebtMonthly: 6000,
    expenses: { ...emptyAnswers.expenses, housing: 10000, food: 8000 },
  };

  it("ignores a card payment already inside the existing EMIs", () => {
    const included = separateCardDebtPayment({ ...base, cardDebtInExistingEmi: "yes" });
    expect(included.value).toBe(0);
    expect(included.note).toBeTruthy();
  });

  it("counts it once when it sits on top of the EMIs", () => {
    expect(separateCardDebtPayment({ ...base, cardDebtInExistingEmi: "no" }).value).toBe(6000);
  });

  it("leaves more free cash flow when the payment is not counted twice", () => {
    const twice = calculateAffordability({ ...base, cardDebtInExistingEmi: "no" });
    const once = calculateAffordability({ ...base, cardDebtInExistingEmi: "yes" });
    expect(once.cashFlow.freeCashFlow - twice.cashFlow.freeCashFlow).toBe(6000);
    expect(once.cashFlow.cardDebt).toBe(0);
    expect(once.cashFlow.existingEmi).toBe(6000);
  });
});

describe("spouse income is never counted in full", () => {
  const married: Answers = {
    ...emptyAnswers,
    maritalStatus: "married",
    spouseContributes: "regular",
    spouseIncome: 40000,
    spouseReliableContribution: "most",
  };
  it("counts only the reliable share", () => {
    const c = spouseContribution(married);
    expect(c.value).toBeGreaterThan(0);
    expect(c.value).toBeLessThan(40000);
  });
  it("prefers an explicit rupee contribution", () => {
    expect(spouseContribution({ ...married, spouseReliableAmount: 12000 }).value).toBe(12000);
  });
  it("counts nothing when the borrower prefers not to say", () => {
    expect(spouseContribution({ ...married, spouseContributes: "prefer_not" }).value).toBe(0);
  });
  it("ignores spouse fields when not married", () => {
    expect(spouseContribution({ ...married, maritalStatus: "single" }).value).toBe(0);
  });
});

describe("collateral routes to a product, and never raises the safe EMI", () => {
  const base: Answers = {
    ...emptyAnswers,
    purpose: "business",
    amount: 1000000,
    incomeType: "self_employed",
    monthlyIncome: 60000,
    documentedAnnualIncome: 480000,
    incomeStability: "varies_some",
    age: 40,
    existingEmi: 0,
    expenses: { ...emptyAnswers.expenses, housing: 8000, food: 10000 },
  };
  it("property routes to a loan against property", () => {
    expect(
      securedProductPurpose({
        ...base,
        hasCollateral: true,
        collateralType: "property",
        collateralValue: 4500000,
      }),
    ).toBe("against_property");
  });
  it("gold routes to a gold loan", () => {
    expect(
      securedProductPurpose({
        ...base,
        hasCollateral: true,
        collateralType: "gold",
        collateralValue: 800000,
      }),
    ).toBe("gold");
  });
  it("an unclear asset routes nowhere", () => {
    expect(
      securedProductPurpose({
        ...base,
        hasCollateral: true,
        collateralType: "unsure",
        collateralValue: 800000,
      }),
    ).toBeNull();
  });
  it("collateral does not increase the safe EMI", () => {
    const without = runAssessment(base);
    const withGold = runAssessment({
      ...base,
      hasCollateral: true,
      collateralType: "gold",
      collateralValue: 900000,
    });
    expect(withGold.safeEmi.value).toBeLessThanOrEqual(without.safeEmi.value);
    expect(withGold.fairRate.value.low).toBeLessThan(without.fairRate.value.low);
  });
});

describe("safe EMI is the lower of the two capacities", () => {
  it("never exceeds either capacity", () => {
    for (const id of ["priya", "ravi", "anita"] as const) {
      const aff = calculateAffordability(sample(id));
      expect(aff.safeEmi.value).toBeLessThanOrEqual(aff.foirSafeEmi + 1);
      expect(aff.safeEmi.value).toBeLessThanOrEqual(
        Math.max(0, aff.cashFlow.emiCapFromCashFlow) + 1,
      );
    }
  });
  it("a lender's ceiling is never below the borrower-safe ceiling", () => {
    for (const id of ["priya", "ravi", "anita"] as const) {
      const r = runAssessment(sample(id));
      expect(r.lenderEmi.value).toBeGreaterThanOrEqual(r.safeEmi.value);
    }
  });
});

describe("unknowns are never treated as zero", () => {
  const base: Answers = {
    ...emptyAnswers,
    purpose: "personal",
    amount: 300000,
    incomeType: "salaried",
    monthlyIncome: 60000,
    incomeStability: "stable",
    age: 30,
    existingEmi: 0,
    expenses: { ...emptyAnswers.expenses, housing: 12000, food: 8000 },
  };
  it("holds back an allowance for unknown insurance", () => {
    const unknown = calculateAffordability({ ...base, hasInsurance: null });
    expect(unknown.cashFlow.insurance).toBeGreaterThan(0);
    const none = calculateAffordability({ ...base, hasInsurance: "no" });
    expect(none.cashFlow.insurance).toBe(0);
  });
  it("names the expense categories left blank", () => {
    expect(calculateAffordability(base).cashFlow.missingCategories.length).toBeGreaterThan(0);
  });
  it("widens the rate band when the credit score is unknown", () => {
    const known = runAssessment({ ...base, creditKnown: "yes", creditScore: 780 });
    const unknown = runAssessment({ ...base, creditKnown: "no" });
    const width = (b: { low: number; high: number }) => b.high - b.low;
    expect(width(unknown.fairRate.value)).toBeGreaterThan(width(known.fairRate.value));
    expect(unknown.confidence.rate).toBe("Low");
  });
});

describe("APR is always above the headline rate", () => {
  it("because fees come off the disbursal", () => {
    const r = runAssessment(sample("priya"));
    expect(r.apr.value.low).toBeGreaterThan(r.fairRate.value.low);
    expect(r.netDisbursed).toBeLessThan(sample("priya").amount!);
  });
});

describe("missed payments materially change the outcome", () => {
  const base: Answers = {
    ...emptyAnswers,
    purpose: "personal",
    amount: 300000,
    incomeType: "salaried",
    monthlyIncome: 60000,
    incomeStability: "stable",
    age: 30,
    existingEmi: 0,
    emergencySavings: "3to6",
    expenses: { ...emptyAnswers.expenses, housing: 12000, food: 8000 },
  };
  it("a recent miss lowers capacity and raises the rate", () => {
    const clean = runAssessment({ ...base, recentBounce: "no" });
    const missed = runAssessment({ ...base, recentBounce: "yes_3m", bounceCount: 1 });
    expect(missed.safeEmi.value).toBeLessThan(clean.safeEmi.value);
    expect(missed.fairRate.value.low).toBeGreaterThan(clean.fairRate.value.low);
  });
  it("more misses cut capacity further", () => {
    const one = runAssessment({ ...base, recentBounce: "yes_3m", bounceCount: 1 });
    const three = runAssessment({ ...base, recentBounce: "yes_3m", bounceCount: 3 });
    expect(three.safeEmi.value).toBeLessThan(one.safeEmi.value);
  });
});

describe("scenario: Priya", () => {
  const r = runAssessment(sample("priya"));
  it("can borrow something, and the numbers hold together", () => {
    expect(["BORROW", "BORROW_LESS"]).toContain(r.verdict.value);
    expect(r.safeEmi.value).toBeGreaterThan(0);
    expect(r.safeAmount.value.high).toBeGreaterThan(0);
  });
  it("prices a strong score at the low end of the personal-loan band", () => {
    expect(r.fairRate.value.low).toBeLessThan(12);
  });
  it("flags a quote above the fair range", () => {
    expect(r.offerComparison).not.toBeNull();
    expect(r.offerComparison!.apr).toBeGreaterThan(r.offerComparison!.rate);
  });
});

describe("scenario: Ravi", () => {
  const r = runAssessment(sample("ravi"));
  it("assesses documented income, not peak cash", () => {
    expect(r.documentedMonthlyIncome).toBe(35000);
    expect(r.assessedMonthlyIncome).toBeLessThanOrEqual(35000);
  });
  it("should borrow less than ₹15 lakh", () => {
    expect(r.verdict.value).toBe("BORROW_LESS");
    expect(r.safeAmount.value.high).toBeLessThan(1500000);
  });
  it("routes his shop to a secured product and prices it lower", () => {
    expect(r.secured).toContain("loan against property");
    expect(r.fairRate.value.low).toBeLessThan(11);
  });
  it("caps the lender sanction by loan-to-value", () => {
    expect(r.lenderAmount.value.high).toBeLessThanOrEqual(4500000 * 0.6);
  });
});

describe("scenario: Anita", () => {
  const r = runAssessment(sample("anita"));
  it("reaches DON'T BORROW from the general rules", () => {
    expect(r.verdict.value).toBe("DONT_BORROW");
  });
  it("does so because of fragility, not because of an arbitrary override", () => {
    expect(hasExpensiveExistingDebt(sample("anita"))).toBe(true);
    expect(r.cashFlow.freeCashFlow).toBeLessThan(r.requestedEmi);
  });
  it("counts her app-loan repayments once", () => {
    expect(r.cashFlow.existingEmi).toBe(6500);
    expect(r.cashFlow.cardDebt).toBe(0);
  });
  it("tells her what to fix first", () => {
    expect(r.nextSteps.length).toBeGreaterThan(2);
  });
});
