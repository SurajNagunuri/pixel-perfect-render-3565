import {
  AGE_LIMITS,
  DEFAULT_TENURES,
  FEE_ASSUMPTIONS,
  HIGHEST_RATE_VALUE,
  HIGH_RISK_UNSECURED_BAND,
  LENDER_FOIR,
  RATE_ADJUSTMENTS,
  RATE_BANDS,
  SAFETY_HAIRCUTS,
  SAFE_FOIR,
  STRESS_ASSUMPTIONS,
  TENURE_OPTIONS,
} from "@/rules/rules";
import type {
  Answers,
  Assessment,
  Band,
  Confidence,
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
    return {
      value: Math.round(stated * 0.6),
      reason:
        "Without documented income, we assess only about 60% of your stated cash income — undocumented income is usually discounted heavily.",
    };
  }
  if (type === "informal") {
    return {
      value: Math.round(stated * 0.85),
      reason:
        "Gig / cash income can dip in a bad month, so we assess about 85% of your typical monthly income.",
    };
  }
  if (a.variableIncomePct === "gt25") {
    return {
      value: Math.round(stated * 0.85),
      reason:
        "More than 25% of your pay is variable, so we assess about 85% of it — incentives are not guaranteed.",
    };
  }
  return { value: stated, reason: "We assess your full stated monthly take-home income." };
}

/* ---------- affordability ---------- */

export function calculateAffordability(a: Answers) {
  const type = effectiveIncomeType(a);
  const income = calculateAssessableIncome(a);
  const safeFoir = SAFE_FOIR[type];
  const lenderFoir = LENDER_FOIR[type];
  const existing = a.existingEmi ?? 0;
  const expenses = a.householdExpenses ?? 0;

  const rawSafe = Math.max(0, income.value * safeFoir - existing);
  const rawLender = Math.max(0, income.value * lenderFoir - existing);

  const haircuts: { label: string; pct: number }[] = [];
  if (a.variableIncomePct === "gt25")
    haircuts.push({ label: "over 25% of income is variable", pct: SAFETY_HAIRCUTS.variableIncomeHigh });
  if (a.incomeStability === "varies_a_lot")
    haircuts.push({ label: "income varies significantly", pct: SAFETY_HAIRCUTS.incomeVariesALot });
  if (a.recentBounce === "yes_3m")
    haircuts.push({ label: "a missed EMI in the last 3 months", pct: SAFETY_HAIRCUTS.recentBounce });
  if (a.emergencySavings === "lt1")
    haircuts.push({ label: "under 1 month of emergency savings", pct: SAFETY_HAIRCUTS.lowSavings });
  const highestRate = a.highestExistingRate ? HIGHEST_RATE_VALUE[a.highestExistingRate] : null;
  if (a.highCostDebt === true || (highestRate !== null && highestRate >= 24))
    haircuts.push({ label: "existing debt above 24%", pct: SAFETY_HAIRCUTS.highCostDebt });

  // Household cash flow uses actual money in hand, not the documented-income discount.
  const cashLeft = Math.max(income.value, a.monthlyIncome ?? 0) - expenses - existing;
  const cashCap = Math.max(0, cashLeft * 0.7);
  if (expenses > income.value * 0.6)
    haircuts.push({ label: "household expenses above 60% of income", pct: SAFETY_HAIRCUTS.stretchedHousehold });

  let safeEmi = rawSafe;
  for (const h of haircuts) safeEmi *= 1 - h.pct;
  const cappedByCash = cashCap < safeEmi;
  safeEmi = Math.max(0, Math.round(Math.min(safeEmi, cashCap)));

  const reasonParts: string[] = [
    `Your safer debt-service ceiling is ${Math.round(safeFoir * 100)}% of the ₹${income.value.toLocaleString("en-IN")}/month we can assess${existing > 0 ? `, and ₹${existing.toLocaleString("en-IN")} of that is already committed to existing EMIs` : ""}.`,
  ];
  if (haircuts.length)
    reasonParts.push(`We then reduced the headroom for ${haircuts.map((h) => h.label).join(", ")}.`);
  if (cappedByCash)
    reasonParts.push(
      `We also capped it so no more than 70% of your leftover household cash (₹${Math.max(0, Math.round(cashLeft)).toLocaleString("en-IN")}/month) goes to a new EMI.`,
    );

  return {
    incomeBasis: income,
    safeFoir,
    lenderFoir,
    existing,
    safeEmi: { value: safeEmi, reason: reasonParts.join(" ") },
    lenderEmi: {
      value: Math.round(rawLender),
      reason: `A lender may work to a higher ${Math.round(lenderFoir * 100)}% debt-service threshold and does not apply borrower-side safety buffers.`,
    },
    haircuts,
    cashLeft,
  };
}

/* ---------- fair rate ---------- */

export function calculateFairRate(a: Answers): {
  value: Band;
  reason: string;
  factors: string[];
} {
  const purpose = a.purpose ?? "other";
  const base = RATE_BANDS[purpose];
  let low = base.low;
  let high = base.high;
  const factors: string[] = [`Indicative ${base.label} band: ${base.low}%–${base.high}%.`];

  const unsecuredHighRisk =
    (a.incomeType === "informal" || a.incomeType === "self_employed") &&
    a.hasCollateral !== true &&
    (purpose === "personal" || purpose === "other" || purpose === "business");

  if (unsecuredHighRisk && (a.creditKnown !== "yes" || (a.creditScore ?? 0) < 680)) {
    high = Math.max(high, HIGH_RISK_UNSECURED_BAND.high);
    low = Math.max(low, HIGH_RISK_UNSECURED_BAND.low - 2);
    factors.push(
      "Unsecured borrowing with limited documentation is priced far higher — lenders in this segment often quote 18–30%+.",
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
  if (a.hasCollateral === true && (a.collateralValue ?? 0) > 0) {
    low += RATE_ADJUSTMENTS.collateralShift;
    high += RATE_ADJUSTMENTS.collateralShift;
    factors.push("Pledgeable collateral can move you to a secured product at a materially lower rate.");
  }
  if (a.incomeType === "self_employed" && a.documentedAnnualIncome === null) {
    high += RATE_ADJUSTMENTS.undocumentedIncomeShift;
    factors.push("Income that is not visible in filings pushes the upper end higher.");
  }
  if (a.recentBounce === "yes_3m") {
    low += RATE_ADJUSTMENTS.recentBounceShift;
    high += RATE_ADJUSTMENTS.recentBounceShift;
    factors.push("A recent missed EMI is the single biggest pricing penalty.");
  }
  const highestRate = a.highestExistingRate ? HIGHEST_RATE_VALUE[a.highestExistingRate] : null;
  if (a.highCostDebt === true || (highestRate !== null && highestRate >= 24)) {
    high += RATE_ADJUSTMENTS.highCostDebtShift;
    factors.push("Existing debt above 24% signals stretched credit and widens the range.");
  }

  low = Math.max(6, Math.round(low * 10) / 10);
  high = Math.max(low + 1, Math.round(high * 10) / 10);

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
  return { low: roundTo(low, 10000), high: roundTo(high, 10000) };
}

function roundTo(n: number, step: number) {
  return Math.max(0, Math.round(n / step) * step);
}

export function calculateSafeBorrowing(emi: number, rate: Band, months: number) {
  const band = bandFromEmi(emi, rate, months);
  return {
    value: band,
    reason: `At a safe EMI of ₹${Math.round(emi).toLocaleString("en-IN")}/month over ${months} months at ${rate.low}%–${rate.high}%, that EMI supports roughly this principal.`,
  };
}

export function calculateLenderLikelySanction(emi: number, rate: Band, months: number, a: Answers) {
  const band = bandFromEmi(emi, rate, months);
  if (a.hasCollateral === true && (a.collateralValue ?? 0) > 0) {
    const ltvCap = roundTo((a.collateralValue as number) * 0.6, 10000);
    band.low = Math.min(band.low, ltvCap);
    band.high = Math.min(Math.max(band.high, band.low), ltvCap);
  }
  return {
    value: band,
    reason: `Using the higher lender-style debt-service threshold${a.hasCollateral ? " and capping at roughly 60% of your collateral value" : ""}. This answers "what might they offer", which is a different question from "what should you carry".`,
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
) {
  const existing = a.existingEmi ?? 0;
  const unstable =
    a.incomeStability === "varies_a_lot" ||
    a.incomeType === "informal" ||
    a.variableIncomePct === "gt25";
  if (unstable) {
    const stressedIncome = assessableIncome * (1 - STRESS_ASSUMPTIONS.incomeDropPct);
    const foir = stressedIncome > 0 ? (requestedEmi + existing) / stressedIncome : 1;
    return {
      kind: "income" as const,
      emi: Math.round(requestedEmi),
      foir,
      safeFoirTarget: safeFoir,
      note: `If your income drops ${Math.round(STRESS_ASSUMPTIONS.incomeDropPct * 100)}% for a few months, your total EMIs would be ${Math.round(foir * 100)}% of income — ${foir > safeFoir ? "above" : "still inside"} your safer target of ${Math.round(safeFoir * 100)}%.`,
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
  };
}

/* ---------- confidence ---------- */

export function generateConfidence(a: Answers) {
  const notes: string[] = [];
  const core = [a.purpose, a.amount, a.incomeType, a.monthlyIncome, a.householdExpenses, a.age];
  const extra = [
    a.incomeStability,
    a.emergencySavings,
    a.employmentTenure ?? a.businessVintage,
    a.creditKnown === "yes" ? a.creditScore : null,
    a.documentedAnnualIncome ?? (a.incomeType === "salaried" ? a.variableIncomePct : null),
    a.existingEmi === null ? null : true,
  ];
  const answered = extra.filter((v) => v !== null && v !== undefined && v !== "unknown").length;
  const coreOk = core.every((v) => v !== null);

  let overall: Confidence = "Low";
  if (coreOk && answered >= 5) overall = "High";
  else if (coreOk && answered >= 3) overall = "Medium";

  let rate: Confidence = "Medium";
  if (a.creditKnown === "yes" && a.creditScore !== null) rate = overall === "Low" ? "Medium" : "High";
  else {
    rate = "Low";
    notes.push("Rate confidence: Low — your credit score is unknown, so the range stays wider.");
  }

  let amount: Confidence = overall;
  if (a.incomeType === "self_employed" && a.documentedAnnualIncome === null) {
    amount = "Low";
    notes.push("Amount confidence is limited because your documented income is unknown.");
  }
  if (a.incomeType === "informal") {
    amount = amount === "High" ? "Medium" : amount;
    notes.push("Cash / gig income is harder for lenders to verify, which lowers certainty.");
  }
  if (a.hasOffer !== true)
    notes.push("APR confidence is limited because some lender charges are unknown.");

  return { overall, rate, amount, notes };
}

/* ---------- verdict ---------- */

export function generateVerdict(
  a: Answers,
  safeEmi: number,
  requestedEmi: number,
  safeBand: Band,
  cashLeft: number,
): { value: Verdict; reason: string } {
  const requested = a.amount ?? 0;
  const highestRate = a.highestExistingRate ? HIGHEST_RATE_VALUE[a.highestExistingRate] : null;
  const expensiveDebt = a.highCostDebt === true || (highestRate !== null && highestRate >= 24);
  const bounce = a.recentBounce === "yes_3m";
  const fragile = a.incomeStability === "varies_a_lot" && a.emergencySavings === "lt1";
  const noRoom = safeEmi <= 0 || cashLeft <= 0;
  const wayOver = safeEmi > 0 && requestedEmi > safeEmi * 1.6;

  const flags: string[] = [];
  if (bounce && expensiveDebt)
    flags.push("you have a missed EMI in the last three months alongside debt priced above 24%");
  if (noRoom)
    flags.push("your income after household expenses and existing EMIs leaves no room for another EMI");
  if (wayOver) flags.push("the EMI on the amount you want is far above what your cash flow can carry");
  if (fragile)
    flags.push("your income swings a lot and there is under a month of savings to absorb a bad month");

  // "Don't borrow" is reserved for genuine fragility, not simply asking for too much.
  const dontBorrow =
    noRoom || (bounce && expensiveDebt) || (wayOver && (bounce || expensiveDebt || fragile));

  if (dontBorrow && flags.length) {
    return {
      value: "DONT_BORROW",
      reason: `Not right now — ${flags.slice(0, 2).join(", and ")}. Another EMI would leave too little room for essentials.`,
    };
  }

  if (requested > safeBand.high * 1.05) {
    return {
      value: "BORROW_LESS",
      reason: `You can carry debt, but ₹${requested.toLocaleString("en-IN")} is above your safer range. Target ₹${safeBand.low.toLocaleString("en-IN")}–₹${safeBand.high.toLocaleString("en-IN")} instead so a bad month doesn't break the EMI.`,
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
  if (a.creditKnown === "yes" && (a.creditScore ?? 0) >= 750)
    out.push(`Strong credit profile (score ${a.creditScore}) — ask for the lower end of the range.`);
  else if (a.creditKnown !== "yes")
    out.push("Credit score unknown — pull your free bureau report before negotiating; it may move your rate.");
  if ((a.existingEmi ?? 0) > 0)
    out.push(`Existing EMIs already use ₹${(a.existingEmi as number).toLocaleString("en-IN")}/month of your income.`);
  else out.push("No existing EMIs, so your full debt-service capacity is available.");
  out.push(
    `Assessed monthly income ₹${Math.round(assessment.documentedMonthlyIncome ?? a.monthlyIncome ?? 0).toLocaleString("en-IN")} with a safer debt burden target of ${Math.round(assessment.stress.safeFoirTarget * 100)}%.`,
  );
  if (assessment.verdict.value === "BORROW")
    out.push("Requested amount remains inside the safer affordability range.");
  if (assessment.verdict.value === "BORROW_LESS")
    out.push("Requested amount is above the safer affordability range.");
  if (a.hasCollateral === true) out.push("Collateral available — a secured product should be priced lower.");
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

/* ---------- top-level ---------- */

export function runAssessment(a: Answers): Assessment {
  const purpose = a.purpose ?? "other";
  const aff = calculateAffordability(a);
  const rate = calculateFairRate(a);
  const midRate = (rate.value.low + rate.value.high) / 2;
  // Pledgeable collateral opens up secured products, which run longer than the unsecured default.
  const securedRoute = a.hasCollateral === true && (a.collateralValue ?? 0) > 0;
  const months = securedRoute
    ? Math.max(DEFAULT_TENURES[purpose], DEFAULT_TENURES.against_property)
    : DEFAULT_TENURES[purpose];

  const safeAmount = calculateSafeBorrowing(aff.safeEmi.value, rate.value, months);
  const lenderAmount = calculateLenderLikelySanction(aff.lenderEmi.value, rate.value, months, a);

  const requested = a.amount ?? 0;
  const requestedEmi = Math.round(calculateEMI(requested, midRate, months));

  const feeRupees = a.hasOffer && a.offerFee !== null ? a.offerFee : requested * FEE_ASSUMPTIONS.assumedProcessingFeePct;
  const otherCharges = requested * FEE_ASSUMPTIONS.otherUpfrontChargesPct;
  const net = Math.max(1, requested - feeRupees - otherCharges);
  const aprLow = calculateAPR(net, calculateEMI(requested, rate.value.low, months), months);
  const aprHigh = calculateAPR(net, calculateEMI(requested, rate.value.high, months), months);

  const stress = calculateStressCase(
    a,
    aff.incomeBasis.value,
    requestedEmi,
    midRate,
    requested,
    months,
    aff.safeFoir,
  );

  const verdict = generateVerdict(a, aff.safeEmi.value, requestedEmi, safeAmount.value, aff.cashLeft);

  const secured =
    a.hasCollateral === true && (a.collateralValue ?? 0) > 0
      ? `You have unencumbered collateral worth about ₹${(a.collateralValue as number).toLocaleString("en-IN")}. Ask specifically about a secured product (loan against property / business loan against collateral) — it is usually several percentage points cheaper than the unsecured quote you'll be offered first.`
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
      reason: aprLow.reason,
    },
    requestedEmi,
    tenureTable: tenureTable(requested, midRate, securedRoute ? "against_property" : purpose),
    assumedTenureMonths: months,
    stress,
    foirNow,
    confidence: generateConfidence(a),
    offerComparison: buildOfferComparison(a, rate.value),
    secured,
    documentedMonthlyIncome: aff.incomeBasis.value,
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
  const fee = a.offerFee ?? 0;
  const net = Math.max(1, a.offerAmount - fee);
  const emi = calculateEMI(a.offerAmount, a.offerRate, a.offerTenureMonths);
  const apr = calculateAPR(net, emi, a.offerTenureMonths).value;
  let verdict: string;
  if (a.offerRate <= fair.low) verdict = "This quote is better than the fair range for your profile. Worth taking.";
  else if (a.offerRate <= fair.high)
    verdict = "This quote sits inside the fair range for your profile — but push for the lower end and a smaller fee.";
  else verdict = "This quote is above the fair range for your profile. Ask for a reduction or compare another lender.";
  return {
    rate: a.offerRate,
    feeRupees: fee,
    netDisbursed: Math.round(net),
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
