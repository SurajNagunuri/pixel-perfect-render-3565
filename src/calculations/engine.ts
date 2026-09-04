import {
  AGE_LIMITS,
  CASH_FLOW_BUFFER,
  COLLATERAL,
  DEBT_LOAD,
  DEFAULT_TENURES,
  EMERGENCY_BUFFER_ADJUSTMENTS,
  EXPENSE_LABELS,
  FEE_ASSUMPTIONS,
  INCOME_STABILITY_ADJUSTMENTS,
  SPOUSE_CONTRIBUTION,
  UNKNOWN_ALLOWANCES,
  HIGHEST_RATE_VALUE,
  HIGH_COST_DEBT_RATE_THRESHOLD,
  HIGH_RISK_UNSECURED_BAND,
  HOUSEHOLD,
  INCOME_ASSESSMENT,
  LENDER_FOIR,
  RATE_ADJUSTMENTS,
  RATE_BAND,
  RATE_BANDS,
  RATE_FLOORS,
  SAFETY_HAIRCUTS,
  SAFE_FOIR,
  SECURED_ROUTE_PURPOSE,
  STRESS_ASSUMPTIONS,
  TENURE_AGE_RULE,
  TENURE_OPTIONS,
  VERDICT_THRESHOLDS,
  principalRoundingStep,
} from "@/rules/rules";

import type {
  Answers,
  Assessment,
  Band,
  Confidence,
  ExpenseCategory,
  IncomeType,
  TenureRow,
  Verdict,
} from "@/types";

/* ---------- core money math ---------- */

export function calculateEMI(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

export function principalFromEMI(emi: number, annualRatePct: number, months: number): number {
  if (emi <= 0 || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return emi * months;
  const f = Math.pow(1 + r, months);
  return (emi * (f - 1)) / (r * f);
}

/** Effective annualised cost from net disbursed amount and the EMI schedule. */
export function calculateAPR(
  netDisbursed: number,
  emi: number,
  months: number,
): { value: number; reason: string } {
  if (netDisbursed <= 0 || emi <= 0 || months <= 0)
    return { value: 0, reason: "Not enough information to estimate an all-in cost." };
  let lo = 0.000001;
  let hi = 0.2; // 20% per month upper bound
  const pv = (r: number) => {
    const f = Math.pow(1 + r, months);
    return (emi * (f - 1)) / (r * f);
  };
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > netDisbursed) lo = mid;
    else hi = mid;
  }
  const monthly = (lo + hi) / 2;
  const apr = (Math.pow(1 + monthly, 12) - 1) * 100;
  return {
    value: apr,
    reason:
      "Estimated APR including known upfront fees — the fee reduces what you actually receive, so the real cost of money is higher than the headline rate.",
  };
}

/* ---------- income assessment ---------- */

function effectiveIncomeType(a: Answers): IncomeType {
  return a.incomeType ?? "salaried";
}

export function documentedMonthlyIncome(a: Answers): number | null {
  if (a.documentedAnnualIncome === null) return null;
  return Math.round(a.documentedAnnualIncome / 12);
}

export function calculateAssessableIncome(a: Answers): { value: number; reason: string } {
  const stated = a.monthlyIncome ?? 0;
  const type = effectiveIncomeType(a);
  const doc = documentedMonthlyIncome(a);

  if (type === "self_employed" || (type === "mixed" && doc !== null)) {
    if (doc !== null) {
      const used = Math.min(stated > 0 ? stated : doc, doc);
      return {
        value: used,
        reason: `Lenders assess self-employed income from documents. Your ITR / records show about ₹${doc.toLocaleString("en-IN")}/month, so we assess on that rather than your peak cash months.`,
      };
    }
    const f = INCOME_ASSESSMENT.undocumentedSelfEmployedFactor;
    return {
      value: Math.round(stated * f),
      reason: `Without documented income, we assess only about ${Math.round(f * 100)}% of your stated cash income — undocumented income is usually discounted heavily.`,
    };
  }
  if (type === "informal") {
    const f = INCOME_ASSESSMENT.informalFactor;
    return {
      value: Math.round(stated * f),
      reason: `Gig / cash income can dip in a bad month, so we assess about ${Math.round(f * 100)}% of your typical monthly income.`,
    };
  }
  if (a.variableIncomePct === "gt25") {
    const f = INCOME_ASSESSMENT.highVariablePayFactor;
    return {
      value: Math.round(stated * f),
      reason: `More than 25% of your pay is variable, so we assess about ${Math.round(f * 100)}% of it — incentives are not guaranteed.`,
    };
  }
  return { value: stated, reason: "We assess your full stated monthly take-home income." };
}

/** True when the borrower carries debt priced at or above the high-cost threshold. */
export function hasExpensiveExistingDebt(a: Answers): boolean {
  const highestRate = a.highestExistingRate ? HIGHEST_RATE_VALUE[a.highestExistingRate] : null;
  return a.highCostDebt === true || (highestRate !== null && highestRate >= HIGH_COST_DEBT_RATE_THRESHOLD);
}

/** Cash actually in hand each month — never the documented-income discount. */
export function householdCashIncome(a: Answers, assessed: number): number {
  return Math.max(assessed, a.monthlyIncome ?? 0);
}

/* ---------- household picture ---------- */

/** Total monthly household spending, plus the categories the borrower left blank. */
export function householdExpenseTotal(a: Answers): {
  total: number;
  children: number;
  missing: string[];
  usedLegacy: boolean;
} {
  const entries = Object.entries(a.expenses) as [ExpenseCategory, number | null][];
  const answered = entries.filter(([, v]) => v !== null);
  const children = a.childrenMonthlyExpenses ?? 0;

  if (answered.length === 0) {
    // Older answers (or a skipped section) may only carry a single combined figure.
    return {
      total: (a.householdExpenses ?? 0) + children,
      children,
      missing: a.householdExpenses === null ? ["all household expense categories"] : [],
      usedLegacy: a.householdExpenses !== null,
    };
  }
  const total = answered.reduce((sum, [, v]) => sum + (v as number), 0) + children;
  const missing = entries
    .filter(([k, v]) => v === null && !(k === "education" && children > 0))
    .map(([k]) => EXPENSE_LABELS[k]);
  return { total, children, missing, usedLegacy: false };
}

/**
 * Insurance premiums are recurring household commitments, never debt: they reduce the
 * money available for a new EMI but they never enter the FOIR calculation.
 */
export function insurancePremiumTotal(
  a: Answers,
  income: number,
): { total: number; known: boolean; assumption: string | null } {
  if (a.hasInsurance === "yes") {
    const total = (a.insuranceHealth ?? 0) + (a.insuranceLife ?? 0) + (a.insuranceOther ?? 0);
    if (total > 0) return { total, known: true, assumption: null };
  }
  if (a.hasInsurance === "no") return { total: 0, known: true, assumption: null };
  const allowance = Math.round(income * UNKNOWN_ALLOWANCES.insuranceShareOfIncome);
  return {
    total: allowance,
    known: false,
    assumption: `Insurance premiums unknown, so instead of assuming zero we hold back about ₹${allowance.toLocaleString("en-IN")}/month (${Math.round(UNKNOWN_ALLOWANCES.insuranceShareOfIncome * 100)}% of income) as a placeholder.`,
  };
}

/** Only the part of a spouse's income that reliably reaches the household. */
export function spouseContribution(a: Answers): { value: number; reason: string | null } {
  if (a.maritalStatus !== "married" || a.spouseContributes === null) return { value: 0, reason: null };
  const regularity = SPOUSE_CONTRIBUTION.regularity[a.spouseContributes];
  if (regularity === 0 || a.spouseIncome === null)
    return {
      value: 0,
      reason:
        a.spouseContributes === "prefer_not"
          ? "You preferred not to share spouse income, so we count none of it. That keeps the estimate conservative rather than optimistic."
          : null,
    };
  const share = SPOUSE_CONTRIBUTION.share[a.spouseReliableContribution ?? "unsure"];
  const value = Math.round(a.spouseIncome * regularity * share);
  return {
    value,
    reason: `Your spouse earns about ₹${a.spouseIncome.toLocaleString("en-IN")}/month. We count ₹${value.toLocaleString("en-IN")} of it as reliably available for household costs and repayment — never the full amount.`,
  };
}

/** Income the household can actually plan around, borrower plus reliable spouse share. */
export function reliableHouseholdIncome(a: Answers, assessed: number) {
  const borrower = householdCashIncome(a, assessed);
  const spouse = spouseContribution(a);
  return { borrower, spouse: spouse.value, total: borrower + spouse.value, spouseReason: spouse.reason };
}

/* ---------- affordability ---------- */

export function calculateAffordability(a: Answers) {
  const type = effectiveIncomeType(a);
  const income = calculateAssessableIncome(a);
  const safeFoir = SAFE_FOIR[type];
  const lenderFoir = LENDER_FOIR[type];
  /** Unknown existing EMI is unknown, not zero — we say so rather than assuming free capacity. */
  const existingKnown = a.existingEmi !== null;
  const existing = a.existingEmi ?? 0;
  const expenseInfo = householdExpenseTotal(a);
  const expenses = expenseInfo.total;
  const cashIncome = householdCashIncome(a, income.value);
  const household = reliableHouseholdIncome(a, income.value);
  const insurance = insurancePremiumTotal(a, household.total);
  const cardDebt = a.hasCardDebt === true ? (a.cardDebtMonthly ?? 0) : 0;
  const otherCommitments = a.hasOtherCommitments === true ? (a.otherFixedCommitments ?? 0) : 0;

  const rawSafe = Math.max(0, income.value * safeFoir - existing);
  const rawLender = Math.max(0, income.value * lenderFoir - existing);

  const haircuts: { label: string; pct: number }[] = [];
  if (a.variableIncomePct === "gt25")
    haircuts.push({ label: "over 25% of income is variable", pct: SAFETY_HAIRCUTS.variableIncomeHigh });
  const stability = a.incomeStability ? INCOME_STABILITY_ADJUSTMENTS[a.incomeStability] : null;
  if (stability && stability.haircut > 0) haircuts.push({ label: stability.note, pct: stability.haircut });
  if (a.recentBounce === "yes_3m")
    haircuts.push({ label: "a missed EMI in the last 3 months", pct: SAFETY_HAIRCUTS.recentBounce });
  const buffer = a.emergencySavings ? EMERGENCY_BUFFER_ADJUSTMENTS[a.emergencySavings] : null;
  if (buffer && buffer.haircut > 0) haircuts.push({ label: buffer.note, pct: buffer.haircut });
  if (hasExpensiveExistingDebt(a))
    haircuts.push({
      label: `existing debt above ${HIGH_COST_DEBT_RATE_THRESHOLD}%`,
      pct: SAFETY_HAIRCUTS.highCostDebt,
    });
  if ((a.activeLoans ?? 0) >= DEBT_LOAD.manyActiveLoans)
    haircuts.push({
      label: `${a.activeLoans} loans running at the same time`,
      pct: DEBT_LOAD.manyActiveLoansHaircut,
    });
  if (
    a.outstandingPrincipal !== null &&
    cashIncome > 0 &&
    a.outstandingPrincipal > cashIncome * DEBT_LOAD.heavyOutstandingMonthsOfIncome
  )
    haircuts.push({
      label: `outstanding balances above ${DEBT_LOAD.heavyOutstandingMonthsOfIncome} months of income`,
      pct: DEBT_LOAD.heavyOutstandingHaircut,
    });

  /*
   * B. Household cash-flow capacity — a completely separate calculation from FOIR.
   * Reliable household income, minus every recurring commitment, leaves free cash flow;
   * only a conservative share of that may go to a new EMI.
   */
  const missingAllowance =
    expenseInfo.missing.length > 0
      ? Math.round(household.total * UNKNOWN_ALLOWANCES.expenseCategoryShareOfIncome)
      : 0;
  const freeCashFlow =
    household.total - expenses - existing - insurance.total - cardDebt - otherCommitments - missingAllowance;
  const cashCap = Math.max(0, freeCashFlow * CASH_FLOW_BUFFER.value);
  const cashLeft = freeCashFlow;

  if (household.total > 0 && expenses > household.total * HOUSEHOLD.stretchedExpenseRatio)
    haircuts.push({
      label: `household expenses above ${Math.round(HOUSEHOLD.stretchedExpenseRatio * 100)}% of reliable income`,
      pct: SAFETY_HAIRCUTS.stretchedHousehold,
    });

  // C. The safe EMI is the lower of the two capacities, then trimmed for fragility signals.
  const bound = Math.min(rawSafe, cashCap);
  const bindingConstraint: "debt_service" | "cash_flow" = cashCap < rawSafe ? "cash_flow" : "debt_service";
  let safeEmi = bound;
  for (const h of haircuts) safeEmi *= 1 - h.pct;
  safeEmi = Math.max(0, Math.round(safeEmi));

  const assumptions: string[] = [];
  if (insurance.assumption) assumptions.push(insurance.assumption);
  if (missingAllowance > 0)
    assumptions.push(
      `You skipped ${expenseInfo.missing.join(", ").toLowerCase()}, so we hold back about ₹${missingAllowance.toLocaleString("en-IN")}/month for them rather than assuming they cost nothing — and your safer range stays deliberately wider.`,
    );
  if (household.spouseReason) assumptions.push(household.spouseReason);

  const reasonParts: string[] = [
    `Two separate checks. Your lender-style debt-service ceiling is ${Math.round(safeFoir * 100)}% of the ₹${income.value.toLocaleString("en-IN")}/month we can assess${existing > 0 ? `, less the ₹${existing.toLocaleString("en-IN")} already going to existing EMIs` : ""}, which allows about ₹${Math.round(rawSafe).toLocaleString("en-IN")}/month.`,
    `Your household cash-flow check starts from ₹${Math.round(household.total).toLocaleString("en-IN")}/month of reliable household income, and after household expenses (₹${Math.round(expenses).toLocaleString("en-IN")})${existing > 0 ? `, existing EMIs (₹${existing.toLocaleString("en-IN")})` : ""}${insurance.total > 0 ? `, insurance (₹${insurance.total.toLocaleString("en-IN")})` : ""}${cardDebt > 0 ? `, card payments (₹${cardDebt.toLocaleString("en-IN")})` : ""}${otherCommitments > 0 ? `, other fixed commitments (₹${otherCommitments.toLocaleString("en-IN")})` : ""} you have roughly ₹${Math.max(0, Math.round(freeCashFlow)).toLocaleString("en-IN")}/month of free cash flow. We keep a safety buffer and let only ${Math.round(CASH_FLOW_BUFFER.value * 100)}% of that go to a new EMI — about ₹${Math.round(cashCap).toLocaleString("en-IN")}/month.`,
    bindingConstraint === "cash_flow"
      ? "Your safe EMI is limited by household cash flow, not by lender-style eligibility, so we use the lower, safer number."
      : "Here the debt-service ceiling is the tighter of the two, so that is the number we use.",
  ];
  if (!existingKnown)
    reasonParts.push(
      "You didn't tell us your existing EMIs, so we could not subtract them — if you do have EMIs running, your real ceiling is lower than this.",
    );
  if (haircuts.length)
    reasonParts.push(`We then reduced the headroom for ${haircuts.map((h) => h.label).join(", ")}.`);
  if (assumptions.length) reasonParts.push(assumptions.join(" "));

  return {
    incomeBasis: income,
    safeFoir,
    lenderFoir,
    existing,
    existingKnown,
    cashIncome,
    safeEmi: { value: safeEmi, reason: reasonParts.join(" ") },
    lenderEmi: {
      value: Math.round(rawLender),
      reason: `A lender may work to a higher ${Math.round(lenderFoir * 100)}% debt-service threshold${existing > 0 ? `, still net of your ₹${existing.toLocaleString("en-IN")} existing EMIs` : ""}, looks mainly at debt-service capacity, and does not check whether your household can still live comfortably afterwards.`,
    },

    haircuts,
    cashLeft,
    bindingConstraint,
    foirSafeEmi: Math.round(rawSafe),
    cashFlow: {
      reliableHouseholdIncome: Math.round(household.total),
      borrowerIncome: Math.round(household.borrower),
      spouseContribution: Math.round(household.spouse),
      householdExpenses: Math.round(expenses),
      childrenExpenses: Math.round(expenseInfo.children),
      existingEmi: existing,
      insurance: insurance.total,
      cardDebt,
      otherCommitments,
      freeCashFlow: Math.round(freeCashFlow),
      emiCapFromCashFlow: Math.round(cashCap),
      bufferShare: CASH_FLOW_BUFFER.value,
      missingCategories: expenseInfo.missing,
      assumptions,
    },
  };
}

/* ---------- secured routing ---------- */

/**
 * Pledgeable collateral changes the product, not just the price: it is what lets us
 * quote a secured band, a secured tenure and an LTV-capped sanction.
 */
export function isSecuredRoute(a: Answers): boolean {
  return a.hasCollateral === true && (a.collateralValue ?? 0) >= COLLATERAL.minValueToRouteSecured;
}

/* ---------- fair rate ---------- */

export function calculateFairRate(a: Answers): {
  value: Band;
  reason: string;
  factors: string[];
} {
  const purpose = a.purpose ?? "other";
  const secured = isSecuredRoute(a);
  /** With collateral we price the secured product the borrower should actually ask for. */
  const pricedPurpose = secured ? SECURED_ROUTE_PURPOSE : purpose;
  const base = RATE_BANDS[pricedPurpose];
  let low = base.low;
  let high = base.high;
  const factors: string[] = [`Indicative ${base.label} band: ${base.low}%–${base.high}%.`];
  if (secured && pricedPurpose !== purpose)
    factors.push(
      `Because you have collateral to pledge, we price this as a secured loan rather than an unsecured ${RATE_BANDS[purpose].label.toLowerCase()}.`,
    );

  const unsecuredHighRisk =
    (a.incomeType === "informal" || a.incomeType === "self_employed") &&
    !secured &&
    (purpose === "personal" || purpose === "other" || purpose === "business");

  if (unsecuredHighRisk && (a.creditKnown !== "yes" || (a.creditScore ?? 0) < 680)) {
    high = Math.max(high, HIGH_RISK_UNSECURED_BAND.high);
    low = Math.max(low, HIGH_RISK_UNSECURED_BAND.low - 2);
    factors.push(
      `Unsecured borrowing with limited documentation is priced far higher — lenders in this segment often quote ${HIGH_RISK_UNSECURED_BAND.low}–${HIGH_RISK_UNSECURED_BAND.high}%+.`,
    );
  }

  if (a.creditKnown === "yes" && a.creditScore !== null) {
    const rule = RATE_ADJUSTMENTS.creditScore.find((r) => (a.creditScore as number) >= r.min);
    if (rule) {
      low += rule.shift;
      high += rule.shift + rule.widen;
      factors.push(`${rule.note} moves your range ${rule.shift <= 0 ? "down" : "up"}.`);
    }
  } else {
    high += RATE_ADJUSTMENTS.unknownScoreWiden;
    factors.push(
      "Your credit score is unknown. We do not treat that as a bad score — we simply widen the range because there is less information.",
    );
  }

  if (a.incomeStability === "varies_a_lot") {
    high += RATE_ADJUSTMENTS.unstableIncomeShift;
    factors.push("Income that varies significantly widens the upper end.");
  }
  const vintage = a.employmentTenure ?? a.businessVintage;
  if (vintage === "lt1") {
    low += RATE_ADJUSTMENTS.shortTenureShift;
    high += RATE_ADJUSTMENTS.shortTenureShift;
    factors.push("Under a year in your job/business pushes pricing up.");
  } else if (vintage === "5to10" || vintage === "10plus") {
    low += RATE_ADJUSTMENTS.longTenureShift;
    factors.push("Long, stable tenure earns you a better starting point.");
  }
  if (secured) {
    low += RATE_ADJUSTMENTS.collateralShift;
    high += RATE_ADJUSTMENTS.collateralShift;
    factors.push("Pledgeable collateral can move you to a secured product at a materially lower rate.");
  }
  if ((a.incomeType === "self_employed" || a.incomeType === "mixed") && a.documentedAnnualIncome === null) {
    high += RATE_ADJUSTMENTS.undocumentedIncomeShift;
    factors.push("Income that is not visible in filings pushes the upper end higher.");
  }
  if (a.recentBounce === "yes_3m") {
    low += RATE_ADJUSTMENTS.recentBounceShift;
    high += RATE_ADJUSTMENTS.recentBounceShift;
    factors.push("A recent missed EMI is the single biggest pricing penalty.");
  }
  if (hasExpensiveExistingDebt(a)) {
    high += RATE_ADJUSTMENTS.highCostDebtShift;
    factors.push(
      `Existing debt above ${HIGH_COST_DEBT_RATE_THRESHOLD}% signals stretched credit and widens the range.`,
    );
  }
  if ((a.activeLoans ?? 0) >= DEBT_LOAD.manyActiveLoans) {
    high += DEBT_LOAD.manyActiveLoansRateShift;
    factors.push(
      `${a.activeLoans} loans running at once reads as stacked borrowing and widens the upper end.`,
    );
  }

  // A quoted range is only ever a band — never a single number — so we enforce a floor
  // for the product and a minimum sensible width.
  const floor = RATE_FLOORS[pricedPurpose];
  low = Math.max(floor, Math.round(low * 10) / 10);
  high = Math.max(low + RATE_BAND.minWidthPoints, Math.round(high * 10) / 10);
  factors.push(
    `We keep this as a band, not one number: the floor for this product is about ${floor}%, and where you land inside the band depends on the lender and how you negotiate.`,
  );

  return {
    value: { low, high },
    reason: factors.join(" "),
    factors,
  };
}

/* ---------- amounts ---------- */

function bandFromEmi(emi: number, rate: Band, months: number): Band {
  const high = principalFromEMI(emi, rate.low, months);
  const low = principalFromEMI(emi, rate.high, months);
  const step = principalRoundingStep(high);
  return { low: roundTo(low, step), high: roundTo(high, step) };
}

function roundTo(n: number, step: number) {
  return Math.max(0, Math.round(n / step) * step);
}

export function calculateSafeBorrowing(emi: number, rate: Band, months: number) {
  const band = bandFromEmi(emi, rate, months);
  return {
    value: band,
    reason: `At a safe EMI of ₹${Math.round(emi).toLocaleString("en-IN")}/month over ${months} months at ${rate.low}%–${rate.high}%, that EMI supports roughly this principal. This is a borrower-side ceiling: what you should carry, not what anyone will offer.`,
  };
}

export function calculateLenderLikelySanction(emi: number, rate: Band, months: number, a: Answers) {
  const band = bandFromEmi(emi, rate, months);
  const secured = isSecuredRoute(a);
  if (secured) {
    const ltvCap = roundTo((a.collateralValue as number) * COLLATERAL.ltvCap, principalRoundingStep(band.high));
    band.low = Math.min(band.low, ltvCap);
    band.high = Math.min(Math.max(band.high, band.low), ltvCap);
  }
  return {
    value: band,
    reason: `Using the higher lender-style debt-service threshold${secured ? `, and capping at roughly ${Math.round(COLLATERAL.ltvCap * 100)}% of your collateral value` : ""}. This answers "what might they offer", which is a different question from "what should you carry" — the two numbers are computed separately and should not be read as one.`,
  };
}


/* ---------- tenure table & stress ---------- */

export function tenureTable(principal: number, ratePct: number, purpose: Answers["purpose"]): TenureRow[] {
  const options = TENURE_OPTIONS[purpose ?? "other"];
  return options.map((months) => {
    const emi = calculateEMI(principal, ratePct, months);
    const totalRepayment = emi * months;
    return {
      months,
      emi: Math.round(emi),
      totalInterest: Math.round(totalRepayment - principal),
      totalRepayment: Math.round(totalRepayment),
    };
  });
}

export function calculateStressCase(
  a: Answers,
  assessableIncome: number,
  requestedEmi: number,
  ratePct: number,
  principal: number,
  months: number,
  safeFoir: number,
  /** Free cash flow before the new EMI, so the stress case sees household obligations too. */
  freeCashFlow: number,
  reliableIncome: number,
) {
  const existing = a.existingEmi ?? 0;
  const drop = STRESS_ASSUMPTIONS.incomeDropPct;
  // A 15% income drop removes that much money from free cash flow as well.
  const stressedFreeCashFlow = Math.round(freeCashFlow - reliableIncome * drop - requestedEmi);
  const stressedNote =
    stressedFreeCashFlow >= 0
      ? `Under a ${Math.round(drop * 100)}% income drop, and while paying this EMI, your household would still have about ₹${stressedFreeCashFlow.toLocaleString("en-IN")}/month spare.`
      : `Under a ${Math.round(drop * 100)}% income drop, and while paying this EMI, your household would fall short by about ₹${Math.abs(stressedFreeCashFlow).toLocaleString("en-IN")}/month. Consider a smaller loan or a longer runway before borrowing.`;

  const unstable =
    a.incomeStability === "varies_a_lot" ||
    a.incomeType === "informal" ||
    a.variableIncomePct === "gt25";
  if (unstable) {
    const stressedIncome = assessableIncome * (1 - drop);
    const foir = stressedIncome > 0 ? (requestedEmi + existing) / stressedIncome : 1;
    return {
      kind: "income" as const,
      emi: Math.round(requestedEmi),
      foir,
      safeFoirTarget: safeFoir,
      note: `If your income drops ${Math.round(drop * 100)}% for a few months, your total EMIs would be ${Math.round(foir * 100)}% of income — ${foir > safeFoir ? "above" : "still inside"} your safer target of ${Math.round(safeFoir * 100)}%.`,
      stressedFreeCashFlow,
      stressedNote,
    };
  }
  const stressEmi = calculateEMI(principal, ratePct + STRESS_ASSUMPTIONS.rateIncreasePoints, months);
  const foir = assessableIncome > 0 ? (stressEmi + existing) / assessableIncome : 1;
  return {
    kind: "rate" as const,
    emi: Math.round(stressEmi),
    foir,
    safeFoirTarget: safeFoir,
    note: `If rates rise ${STRESS_ASSUMPTIONS.rateIncreasePoints} percentage points, your EMI becomes ₹${Math.round(stressEmi).toLocaleString("en-IN")} and your debt burden moves to ${Math.round(foir * 100)}% — ${foir > safeFoir ? "above" : "still inside"} your safer target of ${Math.round(safeFoir * 100)}%.`,
    stressedFreeCashFlow,
    stressedNote,
  };
}

/* ---------- confidence ---------- */

export function generateConfidence(a: Answers) {
  const notes: string[] = [];
  const expenseInfo = householdExpenseTotal(a);
  const expensesAnswered = expenseInfo.total > 0;
  const core = [a.purpose, a.amount, a.incomeType, a.monthlyIncome, expensesAnswered ? true : null, a.age];
  const extra = [
    a.incomeStability,
    a.emergencySavings,
    a.employmentTenure ?? a.businessVintage,
    a.creditKnown === "yes" ? a.creditScore : null,
    a.documentedAnnualIncome ?? (a.incomeType === "salaried" ? a.variableIncomePct : null),
    a.existingEmi === null ? null : true,
    a.hasInsurance === null || a.hasInsurance === "unknown" ? null : true,
    a.maritalStatus === "married"
      ? a.spouseContributes === null || a.spouseContributes === "prefer_not"
        ? null
        : true
      : a.maritalStatus,
  ];
  const answered = extra.filter((v) => v !== null && v !== undefined && v !== "unknown").length;
  const coreOk = core.every((v) => v !== null);

  let overall: Confidence = "Low";
  if (coreOk && answered >= 6) overall = "High";
  else if (coreOk && answered >= 4) overall = "Medium";

  // Missing household information must never look like certainty.
  if (expenseInfo.missing.length >= 3) {
    overall = overall === "High" ? "Medium" : overall;
    notes.push(
      `We have enough information to estimate debt capacity, but ${expenseInfo.missing.length} household expense categories are missing, so your safe borrowing range is intentionally wider.`,
    );
  }
  if (a.hasInsurance === null || a.hasInsurance === "unknown") {
    overall = overall === "High" ? "Medium" : overall;
    notes.push(
      "Insurance premiums are unknown. We do not assume they are zero — we hold back a small allowance instead, which keeps the range wider.",
    );
  }
  if (a.maritalStatus === "married" && (a.spouseReliableContribution === "unsure" || a.spouseContributes === "prefer_not")) {
    overall = overall === "High" ? "Medium" : overall;
    notes.push(
      "How much of your spouse's income reliably reaches the household is uncertain, so we count only a conservative part of it rather than treating it as guaranteed.",
    );
  }
  if (a.emergencySavings === "unknown")
    notes.push("Your savings cushion is unknown, which widens the range rather than lowering your capacity.");
  if (a.emergencySavings === "6plus")
    notes.push("A 6+ month savings cushion is the strongest single sign that you can absorb a bad month.");
  if (expenseInfo.children > 0)
    notes.push(
      `Your children's monthly costs of ₹${expenseInfo.children.toLocaleString("en-IN")} are counted in your household cash flow, which lowers the EMI we think is comfortable.`,
    );

  let rate: Confidence = "Medium";
  if (a.creditKnown === "yes" && a.creditScore !== null) {
    rate = overall === "Low" ? "Medium" : "High";
    notes.push(
      `Rate confidence: ${rate} — you know your credit score (${a.creditScore}), which is the single biggest driver of pricing.`,
    );
  } else {
    rate = "Low";
    notes.push(
      "Rate confidence: Low — your credit score is unknown, so the range stays wider. Unknown is not the same as bad; pulling your free report can narrow this.",
    );
  }

  // Never claim high overall confidence when the score is unknown or income is undocumented.
  if (a.creditKnown !== "yes" && overall === "High") {
    overall = "Medium";
    notes.push("Overall confidence is capped at Medium while your credit score is unknown.");
  }
  if (a.incomeType === "self_employed" || a.incomeType === "informal") {
    if (overall === "High") overall = "Medium";
    notes.push(
      "Overall confidence is capped at Medium because income for self-employed and cash earners is harder to verify.",
    );
  }

  let amount: Confidence = overall;
  if ((a.incomeType === "self_employed" || a.incomeType === "mixed") && a.documentedAnnualIncome === null) {
    amount = "Low";
    notes.push(
      "Amount confidence is Low because your documented income is unknown — a lender will size the loan on filings, not on cash takings.",
    );
  }
  if (a.incomeType === "informal") {
    amount = amount === "High" ? "Medium" : amount;
    notes.push("Cash / gig income is harder for lenders to verify, which lowers certainty.");
  }
  if (a.existingEmi === null) {
    amount = amount === "High" ? "Medium" : amount;
    notes.push(
      "You skipped existing EMIs, so we could not deduct them. If you do have loans running, treat every amount here as an over-estimate.",
    );
  }
  if ((a.existingEmi ?? 0) > 0 && (a.highestExistingRate === null || a.highestExistingRate === "unknown"))
    notes.push(
      "The rate on your existing loans is unknown, so we couldn't tell whether refinancing would free up capacity.",
    );
  if (a.hasOffer !== true)
    notes.push(
      `APR confidence is limited because no quote was entered — we assume a ${(FEE_ASSUMPTIONS.assumedProcessingFeePct * 100).toFixed(1)}% processing fee.`,
    );
  if (overall === "High" && rate === "High" && amount === "High")
    notes.push(
      "You answered everything that materially moves these numbers, so each output here is as tight as this tool can make it.",
    );

  return { overall, rate, amount, notes };
}

/* ---------- verdict ---------- */

export function generateVerdict(
  a: Answers,
  safeEmi: number,
  requestedEmi: number,
  safeBand: Band,
  cashLeft: number,
  secured: boolean,
): { value: Verdict; reason: string } {
  const requested = a.amount ?? 0;
  const expensiveDebt = hasExpensiveExistingDebt(a);
  const bounce = a.recentBounce === "yes_3m";
  const fragile = a.incomeStability === "varies_a_lot" && a.emergencySavings === "lt1";
  const noRoom = safeEmi <= 0 || cashLeft <= 0;
  const wayOver = safeEmi > 0 && requestedEmi > safeEmi * VERDICT_THRESHOLDS.farAboveSafeEmiMultiple;
  const eatsFreeCash = cashLeft > 0 && requestedEmi > cashLeft;

  const flags: string[] = [];
  if (bounce && expensiveDebt)
    flags.push(
      `you have a missed EMI in the last three months alongside debt priced above ${HIGH_COST_DEBT_RATE_THRESHOLD}%`,
    );
  if (noRoom)
    flags.push(
      "after household expenses, insurance, existing EMIs and other recurring commitments there is no room left for another EMI",
    );
  if (eatsFreeCash)
    flags.push("this EMI is larger than all the money left over after your household commitments");
  if (wayOver) flags.push("the EMI on the amount you want is far above what your cash flow can carry");
  if (fragile)
    flags.push("your income swings a lot and there is under a month of savings to absorb a bad month");

  // "Don't borrow" is reserved for genuine fragility, not simply asking for too much.
  // Collateral is never on its own a reason to stop — it is a reason to change product.
  const dontBorrow =
    noRoom || (bounce && expensiveDebt) || (wayOver && (bounce || expensiveDebt || fragile));

  if (dontBorrow && flags.length) {
    return {
      value: "DONT_BORROW",
      reason: `Not right now — ${flags.slice(0, 2).join(", and ")}. Another EMI would leave too little room for essentials.${secured ? " If you must raise money, do it against your collateral, not on an unsecured loan." : ""}`,
    };
  }

  if (requested > safeBand.high * VERDICT_THRESHOLDS.amountBandTolerance) {
    return {
      value: "BORROW_LESS",
      reason: `You can carry debt, but ₹${requested.toLocaleString("en-IN")} is above your safer range. Target ₹${safeBand.low.toLocaleString("en-IN")}–₹${safeBand.high.toLocaleString("en-IN")} instead so a bad month doesn't break the EMI.${secured ? " Ask for it as a secured loan against your collateral — the lower rate is what makes a larger amount affordable." : ""}`,
    };
  }

  if (requestedEmi > safeEmi) {
    return {
      value: "BORROW_LESS",
      reason:
        "The amount is close to workable, but the EMI it implies sits above your safer ceiling. Trim the amount or stretch the tenure.",
    };
  }

  return {
    value: "BORROW",
    reason: `₹${requested.toLocaleString("en-IN")} sits inside your safer affordability range and the EMI stays under your ceiling of ₹${Math.round(safeEmi).toLocaleString("en-IN")}/month.`,
  };
}

export function generateReasons(a: Answers, assessment: Omit<Assessment, "reasons" | "nextSteps">): string[] {
  const out: string[] = [];
  if (a.creditKnown === "yes" && (a.creditScore ?? 0) >= VERDICT_THRESHOLDS.strongCreditScore)
    out.push(`Strong credit profile (score ${a.creditScore}) — ask for the lower end of the range.`);
  else if (a.creditKnown !== "yes")
    out.push("Credit score unknown — pull your free bureau report before negotiating; it may move your rate.");
  if ((a.existingEmi ?? 0) > 0) {
    const loans = a.activeLoans ?? 0;
    out.push(
      `Existing EMIs already use ₹${(a.existingEmi as number).toLocaleString("en-IN")}/month of your income${loans > 0 ? ` across ${loans} active ${loans === 1 ? "loan" : "loans"}${a.outstandingPrincipal ? ` (₹${a.outstandingPrincipal.toLocaleString("en-IN")} still outstanding)` : ""}` : ""}, and that is deducted before your ceiling is set.`,
    );
  } else if (a.existingEmi === null)
    out.push("You skipped existing EMIs — anything already running reduces every number on this page.");
  else out.push("No existing EMIs, so your full debt-service capacity is available.");

  out.push(
    `Assessed monthly income ₹${Math.round(assessment.assessedMonthlyIncome).toLocaleString("en-IN")}${assessment.documentedMonthlyIncome !== null ? ` (from documented income of ₹${assessment.documentedMonthlyIncome.toLocaleString("en-IN")}/month, not cash takings)` : ""} with a safer debt burden target of ${Math.round(assessment.stress.safeFoirTarget * 100)}%.`,
  );
  if (assessment.verdict.value === "BORROW")
    out.push("Requested amount remains inside the safer affordability range.");
  if (assessment.verdict.value === "BORROW_LESS")
    out.push("Requested amount is above the safer affordability range.");
  if (isSecuredRoute(a))
    out.push("Collateral available — this should be asked for as a secured loan, which is priced lower.");
  return out.slice(0, 4);

}

function nextSteps(a: Answers, verdict: Verdict, secured: string | null): string[] {
  if (verdict === "DONT_BORROW") {
    const steps = [
      "Clear or refinance the most expensive existing debt first — that raises your capacity faster than a new loan.",
      "Rebuild savings to cover at least one month of essential expenses.",
      "Keep every EMI on time for the next 3–6 months; a clean recent record changes pricing sharply.",
      "Revisit borrowing once monthly cash flow improves.",
    ];
    if (secured) steps.splice(1, 0, secured);
    return steps;
  }
  const steps = [
    "Negotiate on APR, not the headline rate — ask for the fee in writing.",
    "Take the shortest tenure whose EMI still stays under your ceiling.",
  ];
  if (secured) steps.unshift(secured);
  if (a.creditKnown !== "yes") steps.push("Check your credit score before applying; it may move your rate band.");
  return steps;
}

/* ---------- tenure & fees ---------- */

/**
 * Age materially limits tenure: the loan has to be repaid inside the borrower's
 * earning years, which is why we ask for age at all.
 */
export function tenureLimitForAge(a: Answers, requested: number): { months: number; note: string | null } {
  if (a.age === null) return { months: requested, note: null };
  const type = effectiveIncomeType(a);
  const endAge = type === "salaried" ? TENURE_AGE_RULE.salariedEndAge : TENURE_AGE_RULE.otherEndAge;
  const allowed = Math.max(TENURE_AGE_RULE.minMonths, Math.round((endAge - a.age) * 12));
  if (allowed >= requested) return { months: requested, note: null };
  return {
    months: allowed,
    note: `At ${a.age}, lenders normally want the loan closed by about ${endAge}, so we assessed ${allowed} months instead of ${requested}.`,
  };
}

/** Upfront charges deducted before the money reaches you — the reason APR beats the headline rate. */
export function upfrontCharges(a: Answers, amount: number) {
  const quoted = a.hasOffer === true && a.offerFee !== null;
  const fee = quoted ? (a.offerFee as number) : amount * FEE_ASSUMPTIONS.assumedProcessingFeePct;
  const other = amount * FEE_ASSUMPTIONS.otherUpfrontChargesPct;
  return {
    fee,
    other,
    quoted,
    total: fee + other,
    netDisbursed: Math.max(1, amount - fee - other),
    reason: quoted
      ? `Your quoted processing fee of ₹${Math.round(fee).toLocaleString("en-IN")} plus about ${(FEE_ASSUMPTIONS.otherUpfrontChargesPct * 100).toFixed(1)}% of other upfront charges never reaches your account, so the true annualised cost is higher than the headline rate.`
      : `No quote yet, so we assume a ${(FEE_ASSUMPTIONS.assumedProcessingFeePct * 100).toFixed(1)}% processing fee (₹${Math.round(fee).toLocaleString("en-IN")}) plus ${(FEE_ASSUMPTIONS.otherUpfrontChargesPct * 100).toFixed(1)}% of other upfront charges. Those come off the disbursal, so the true annualised cost is higher than the headline rate.`,
  };
}

/* ---------- top-level ---------- */

export function runAssessment(a: Answers): Assessment {
  const purpose = a.purpose ?? "other";
  const aff = calculateAffordability(a);
  const rate = calculateFairRate(a);
  const midRate = (rate.value.low + rate.value.high) / 2;
  // Pledgeable collateral opens up secured products, which run longer than the unsecured default.
  const securedRoute = isSecuredRoute(a);
  const tenurePurpose = securedRoute ? SECURED_ROUTE_PURPOSE : purpose;
  const requestedTenure = securedRoute
    ? Math.max(DEFAULT_TENURES[purpose], DEFAULT_TENURES[SECURED_ROUTE_PURPOSE])
    : DEFAULT_TENURES[purpose];
  const tenureLimit = tenureLimitForAge(a, requestedTenure);
  const months = tenureLimit.months;

  const safeAmount = calculateSafeBorrowing(aff.safeEmi.value, rate.value, months);
  const lenderAmount = calculateLenderLikelySanction(aff.lenderEmi.value, rate.value, months, a);

  const requested = a.amount ?? 0;
  const requestedEmi = Math.round(calculateEMI(requested, midRate, months));

  const charges = upfrontCharges(a, requested);
  const aprLow = calculateAPR(charges.netDisbursed, calculateEMI(requested, rate.value.low, months), months);
  const aprHigh = calculateAPR(charges.netDisbursed, calculateEMI(requested, rate.value.high, months), months);

  const stress = calculateStressCase(
    a,
    aff.incomeBasis.value,
    requestedEmi,
    midRate,
    requested,
    months,
    aff.safeFoir,
  );

  const verdict = generateVerdict(
    a,
    aff.safeEmi.value,
    requestedEmi,
    safeAmount.value,
    aff.cashLeft,
    securedRoute,
  );

  const secured = securedRoute
    ? `You have unencumbered collateral worth about ₹${(a.collateralValue as number).toLocaleString("en-IN")}. Ask specifically about a secured product (loan against property / business loan against collateral) — it is usually several percentage points cheaper than the unsecured quote you'll be offered first, and we have already priced your range as a secured loan.`
    : null;

  const foirNow =
    aff.incomeBasis.value > 0 ? (requestedEmi + (a.existingEmi ?? 0)) / aff.incomeBasis.value : 1;

  const partial: Omit<Assessment, "reasons" | "nextSteps"> = {
    verdict,
    safeEmi: aff.safeEmi,
    lenderEmi: aff.lenderEmi,
    safeAmount,
    lenderAmount,
    fairRate: { value: rate.value, reason: rate.reason },
    apr: {
      value: { low: Math.round(aprLow.value * 10) / 10, high: Math.round(aprHigh.value * 10) / 10 },
      reason: `${charges.reason} ${aprLow.reason}`,
    },
    requestedEmi,
    tenureTable: tenureTable(requested, midRate, tenurePurpose).filter(
      (row) => row.months <= tenureLimit.months || tenureLimit.note === null,
    ),
    assumedTenureMonths: months,
    tenureNote: tenureLimit.note,
    upfrontFee: Math.round(charges.fee),
    netDisbursed: Math.round(charges.netDisbursed),
    feeIsQuoted: charges.quoted,
    assessedMonthlyIncome: aff.incomeBasis.value,
    stress,
    foirNow,
    confidence: generateConfidence(a),
    offerComparison: buildOfferComparison(a, rate.value),
    secured,
    documentedMonthlyIncome:
      a.documentedAnnualIncome !== null ? Math.round(a.documentedAnnualIncome / 12) : null,
    existingEmiKnown: a.existingEmi !== null,
  };


  return {
    ...partial,
    reasons: generateReasons(a, partial),
    nextSteps: nextSteps(a, verdict.value, secured),
  };
}

function buildOfferComparison(a: Answers, fair: Band) {
  if (a.hasOffer !== true || a.offerRate === null || a.offerAmount === null || a.offerTenureMonths === null)
    return null;
  // Same upfront-charge model as the APR card, so the two numbers can't disagree.
  const charges = upfrontCharges(a, a.offerAmount);
  const emi = calculateEMI(a.offerAmount, a.offerRate, a.offerTenureMonths);
  const apr = calculateAPR(charges.netDisbursed, emi, a.offerTenureMonths).value;
  let verdict: string;
  if (a.offerRate <= fair.low) verdict = "This quote is better than the fair range for your profile. Worth taking.";
  else if (a.offerRate <= fair.high)
    verdict = "This quote sits inside the fair range for your profile — but push for the lower end and a smaller fee.";
  else verdict = "This quote is above the fair range for your profile. Ask for a reduction or compare another lender.";
  return {
    rate: a.offerRate,
    feeRupees: Math.round(charges.fee),
    netDisbursed: Math.round(charges.netDisbursed),
    apr: Math.round(apr * 10) / 10,
    verdict,
  };
}


/* ---------- validation ---------- */

export function validateAge(age: number | null): string | null {
  if (age === null) return "Please enter your age.";
  if (!Number.isFinite(age) || age < AGE_LIMITS.min || age > AGE_LIMITS.max)
    return `Age must be between ${AGE_LIMITS.min} and ${AGE_LIMITS.max}.`;
  return null;
}
