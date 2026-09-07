import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Info, Lock } from "lucide-react";
import { Page } from "@/components/SiteShell";
import { ChoiceGroup, MoneyInput, PlainInput, QuestionShell, SkipButton } from "@/components/inputs";
import { setAnswers, useAnswers } from "@/lib/store";
import { formatINR } from "@/lib/inr";
import { CREDIT_SCORE_RANGE, EXPENSE_LABELS, HIGH_COST_DEBT_RATE_THRESHOLD } from "@/rules/rules";
import { validateAge } from "@/calculations/engine";
import type { Answers, ExpenseCategory } from "@/types";

export const Route = createFileRoute("/assess")({
  head: () => ({
    meta: [
      { title: "Your borrowing position — Borrower Copilot" },
      {
        name: "description",
        content:
          "Answer 8-10 adaptive questions about income, EMIs and expenses to get your safe borrowing amount, fair rate band and EMI ceiling.",
      },
      { property: "og:title", content: "Your borrowing position — Borrower Copilot" },
      {
        property: "og:description",
        content: "A short adaptive questionnaire that produces a borrower-side negotiation position.",
      },
    ],
  }),
  component: Assess,
});

type StepId =
  | "purpose"
  | "amount"
  | "incomeType"
  | "income"
  | "stability"
  | "weakMonth"
  | "employmentTenure"
  | "variablePct"
  | "businessVintage"
  | "documented"
  | "collateral"
  | "collateralValue"
  | "collateralLoan"
  | "highCostDebt"
  | "bounce"
  | "bounceCount"
  | "family"
  | "dependentsAny"
  | "dependentsWho"
  | "dependents"
  | "children"
  | "spouse"
  | "spouseIncome"
  | "spouseShare"
  | "existingEmi"
  | "debtCount"
  | "debtOutstanding"
  | "debtRate"
  | "cardDebt"
  | "cardDebtAmount"
  | "cardDebtBalance"
  | "expenses"
  | "insurance"
  | "insuranceDetail"
  | "commitments"
  | "commitmentsAmount"
  | "savings"
  | "age"
  | "credit"
  | "creditScore"
  | "offer"
  | "offerDetail";

type Section =
  | "Your plan"
  | "Your income"
  | "Your household"
  | "Your commitments"
  | "Your cushion"
  | "Your quote";

const SECTIONS: Section[] = [
  "Your plan",
  "Your income",
  "Your household",
  "Your commitments",
  "Your cushion",
  "Your quote",
];

const SECTION_OF: Record<StepId, Section> = {
  purpose: "Your plan",
  amount: "Your plan",
  incomeType: "Your income",
  income: "Your income",
  stability: "Your income",
  weakMonth: "Your income",
  employmentTenure: "Your income",
  variablePct: "Your income",
  businessVintage: "Your income",
  documented: "Your income",
  collateral: "Your income",
  collateralValue: "Your income",
  collateralLoan: "Your income",
  family: "Your household",
  dependentsAny: "Your household",
  dependentsWho: "Your household",
  dependents: "Your household",
  children: "Your household",
  spouse: "Your household",
  spouseIncome: "Your household",
  spouseShare: "Your household",
  expenses: "Your household",
  existingEmi: "Your commitments",
  debtCount: "Your commitments",
  debtOutstanding: "Your commitments",
  debtRate: "Your commitments",
  cardDebt: "Your commitments",
  cardDebtAmount: "Your commitments",
  cardDebtBalance: "Your commitments",
  insurance: "Your commitments",
  insuranceDetail: "Your commitments",
  commitments: "Your commitments",
  commitmentsAmount: "Your commitments",
  highCostDebt: "Your commitments",
  bounce: "Your commitments",
  bounceCount: "Your commitments",
  savings: "Your cushion",
  age: "Your cushion",
  credit: "Your cushion",
  creditScore: "Your cushion",
  offer: "Your quote",
  offerDetail: "Your quote",
};

/** Steps that are answered with a single tap, so we can advance automatically. */
const AUTO_ADVANCE: StepId[] = [
  "purpose",
  "incomeType",
  "stability",
  "employmentTenure",
  "variablePct",
  "businessVintage",
  "debtRate",
  "highCostDebt",
  "bounce",
  "savings",
  "family",
  "dependentsAny",
  "dependents",
  "children",
  "spouseShare",
  "collateralLoan",
];

/** True when income moves month to month, so a weaker-month figure is worth asking for. */
function hasVariableIncome(a: Answers): boolean {
  return (
    a.incomeType === "self_employed" ||
    a.incomeType === "informal" ||
    a.incomeType === "mixed" ||
    a.variableIncomePct === "gt25" ||
    a.incomeStability === "varies_some" ||
    a.incomeStability === "varies_a_lot"
  );
}

/** Adaptive branching: a borrower only ever sees questions that change their result. */
function visibleSteps(a: Answers): StepId[] {
  const steps: StepId[] = ["purpose", "amount", "incomeType", "income", "stability"];

  if (hasVariableIncome(a)) steps.push("weakMonth");
  if (a.incomeType === "salaried" || a.incomeType === "mixed") steps.push("employmentTenure", "variablePct");
  if (a.incomeType === "self_employed" || a.incomeType === "mixed") steps.push("businessVintage", "documented");
  steps.push("collateral");
  if (a.hasCollateral === true) steps.push("collateralValue", "collateralLoan");

  // Household shape: asked after income, because it changes cash-flow capacity, not pricing.
  steps.push("family", "dependentsAny");
  if (a.hasDependents === "yes") {
    steps.push("dependentsWho", "dependents");
    if (a.dependentTypes?.includes("children")) steps.push("children");
  }
  if (a.maritalStatus === "married") {
    steps.push("spouse");
    if (a.spouseContributes === "regular" || a.spouseContributes === "sometimes")
      steps.push("spouseIncome", "spouseShare");
  }
  steps.push("expenses");

  steps.push("existingEmi");
  if ((a.existingEmi ?? 0) > 0) steps.push("debtCount", "debtOutstanding", "debtRate");
  steps.push("cardDebt");
  if (a.hasCardDebt === true) steps.push("cardDebtAmount", "cardDebtBalance");

  steps.push("insurance");
  if (a.hasInsurance === "yes") steps.push("insuranceDetail");
  steps.push("commitments");
  if (a.hasOtherCommitments === true) steps.push("commitmentsAmount");

  // Repayment history matters for every borrower, not only informal earners.
  steps.push("highCostDebt", "bounce");
  if (a.recentBounce === "yes_3m" || a.recentBounce === "yes_older") steps.push("bounceCount");

  steps.push("savings", "age", "credit");
  if (a.creditKnown === "yes") steps.push("creditScore");

  steps.push("offer");
  if (a.hasOffer === true) steps.push("offerDetail");
  return steps;
}


function Assess() {
  const a = useAnswers();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const steps = useMemo(() => visibleSteps(a), [a]);
  const clamped = Math.min(index, steps.length - 1);
  const step: StepId = steps[clamped] ?? "purpose";
  const topRef = useRef<HTMLDivElement>(null);

  // Any change to an answer clears the error — validation should never nag.
  useEffect(() => setError(null), [a]);
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [clamped]);

  function next() {
    const err = validate(step, a);
    if (err) {
      setError(err);
      return;
    }
    if (clamped >= steps.length - 1) {
      navigate({ to: "/results" });
      return;
    }
    setIndex(clamped + 1);
  }

  function back() {
    if (clamped === 0) navigate({ to: "/" });
    else setIndex(clamped - 1);
  }

  /** Tapping a single-choice answer is the answer — no extra Continue tap needed. */
  function answered() {
    if (!AUTO_ADVANCE.includes(step)) return;
    window.setTimeout(() => setIndex((i) => Math.min(i + 1, visibleSteps(a).length)), 160);
  }

  const currentSection = SECTION_OF[step];
  const sectionIndex = SECTIONS.indexOf(currentSection);
  const progress = ((clamped + 1) / steps.length) * 100;
  const last = clamped >= steps.length - 1;

  return (
    <Page bare>
      <div ref={topRef} className="mx-auto max-w-xl px-5 pb-40 pt-6 sm:pb-16 sm:pt-10">
        {/* Progress */}
        <div className="flex items-center gap-1.5">
          {SECTIONS.map((s, i) => (
            <span
              key={s}
              aria-hidden
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < sectionIndex ? "bg-primary" : i === sectionIndex ? "bg-primary/45" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <p className="eyebrow truncate">{currentSection}</p>
          <p className="num shrink-0 text-xs text-muted-foreground">
            {clamped + 1} / {steps.length}
          </p>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted sm:hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-8 sm:mt-10">
          <StepBody step={step} a={a} onAnswered={answered} />
          {error ? null : null}
        </div>

        {/* Desktop nav */}
        <div className="mt-9 hidden items-center gap-3 sm:flex">
          <NavButtons back={back} next={next} last={last} error={error} />
        </div>

        <p className="mt-10 hidden items-start gap-2 text-xs leading-relaxed text-muted-foreground sm:flex">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Nothing you type leaves your browser.{" "}
            <Link to="/rules" className="underline underline-offset-4">
              See how we calculate this
            </Link>
            .
          </span>
        </p>
      </div>

      {/* Mobile sticky nav — thumb-reachable */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-5 pb-5 pt-3 backdrop-blur sm:hidden">
        <NavButtons back={back} next={next} last={last} error={error} />
      </div>
    </Page>
  );
}

function NavButtons({
  back,
  next,
  last,
  error,
}: {
  back: () => void;
  next: () => void;
  last: boolean;
  error: string | null;
}) {
  return (
    <div className="w-full">
      {error ? (
        <p role="alert" className="mb-2.5 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={back}
          aria-label="Back"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-input text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={next}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {last ? "See my position" : "Continue"}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function validate(step: StepId, a: Answers): string | null {
  switch (step) {
    case "purpose":
      return a.purpose ? null : "Pick what you're borrowing for.";
    case "amount":
      if (a.amount === null) return "Enter the amount you're planning to borrow.";
      if (a.amount <= 0) return "The amount must be greater than zero.";
      if (a.amount > 100000000) return "That looks too large — please check the number of zeroes.";
      return null;
    case "incomeType":
      return a.incomeType ? null : "Pick your income type.";
    case "income":
      if (a.monthlyIncome === null) return "Enter your usual monthly income.";
      if (a.monthlyIncome <= 0) return "Monthly income must be greater than zero.";
      return null;
    case "stability":
      return a.incomeStability ? null : "Tell us how stable that income is.";
    case "weakMonth":
      return null;
    case "collateral":
      return a.hasCollateral === null ? "Choose yes or no." : null;
    case "collateralLoan":
      return a.collateralHasLoan === null ? "Choose one option." : null;
    case "bounce":
      return a.recentBounce === null ? "Choose one option." : null;
    case "bounceCount":
      return null;
    case "existingEmi":
      return a.existingEmi === null ? "Enter your current EMIs, or tap “I have no EMIs”." : null;
    case "family":
      return a.maritalStatus === null ? "Choose one option." : null;
    case "dependentsAny":
      return a.hasDependents === null ? "Choose one option." : null;
    case "dependentsWho":
      return a.dependentTypes === null || a.dependentTypes.length === 0
        ? "Pick at least one, or go back and say nobody depends on you."
        : null;
    case "dependents":
      return a.numberOfDependents === null ? "Choose one option." : null;
    case "children":
      return a.childrenCount === null ? "Choose one option." : null;
    case "spouse":
      return a.spouseContributes === null ? "Choose one option." : null;
    case "spouseIncome":
      return null;
    case "spouseShare":
      return a.spouseReliableContribution === null ? "Choose one option." : null;

    case "expenses": {
      const filled = Object.values(a.expenses).some((v) => v !== null);
      if (!filled && a.householdExpenses === null)
        return "Fill in at least one expense — a rough estimate is fine.";
      return null;
    }
    case "insurance":
      return a.hasInsurance === null ? "Choose one option." : null;
    case "cardDebt":
      return a.hasCardDebt === null ? "Choose yes or no." : null;
    case "cardDebtAmount":
      return a.cardDebtMonthly === null ? "Enter a rough monthly payment." : null;
    case "cardDebtBalance":
      return null;

    case "commitments":
      return a.hasOtherCommitments === null ? "Choose yes or no." : null;
    case "commitmentsAmount":
      return a.otherFixedCommitments === null ? "Enter a rough monthly amount." : null;
    case "age":
      return validateAge(a.age);
    case "credit":
      return a.creditKnown ? null : "Choose one option.";
    case "creditScore":
      if (a.creditScore === null) return "Enter your score, or go back and choose “I don't know”.";
      if (a.creditScore < CREDIT_SCORE_RANGE.min || a.creditScore > CREDIT_SCORE_RANGE.max)
        return `Credit scores run from ${CREDIT_SCORE_RANGE.min} to ${CREDIT_SCORE_RANGE.max}.`;
      return null;
    case "offer":
      return a.hasOffer === null ? "Choose yes or no." : null;
    case "offerDetail":
      if (a.offerRate === null || a.offerAmount === null || a.offerTenureMonths === null)
        return "Fill in the rate, amount and tenure of the quote.";
      return null;
    default:
      return null;
  }
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl bg-surface px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function StepBody({
  step,
  a,
  onAnswered,
}: {
  step: StepId;
  a: Answers;
  onAnswered: () => void;
}) {
  const pick = <K extends keyof Answers>(patch: Pick<Answers, K>) => {
    setAnswers(patch);
    onAnswered();
  };

  switch (step) {
    case "purpose":
      return (
        <QuestionShell
          label="What are you borrowing for?"
          hint="Purpose sets the realistic rate band and tenure, so it's the first thing we ask."
        >
          <ChoiceGroup
            columns={2}
            value={a.purpose}
            onChange={(purpose) => pick({ purpose })}
            options={[
              { value: "home", label: "Home" },
              { value: "personal", label: "Personal", sub: "Wedding, education, medical" },
              { value: "vehicle", label: "Vehicle" },
              { value: "business", label: "Business", sub: "Working capital, expansion" },
              { value: "against_property", label: "Against property" },
              { value: "gold", label: "Gold" },
              { value: "other", label: "Something else" },
            ]}
          />
        </QuestionShell>
      );

    case "amount":
      return (
        <QuestionShell
          label="How much are you planning to borrow?"
          hint="A rough figure is fine. We'll tell you whether it sits inside your safer range."
        >
          <MoneyInput
            autoFocus
            value={a.amount}
            onChange={(amount) => setAnswers({ amount })}
            placeholder="8,00,000"
            quickAdd={[200000, 500000, 1000000, 2500000]}
          />
        </QuestionShell>
      );

    case "incomeType":
      return (
        <QuestionShell
          label="How do you earn?"
          hint="Salaried, self-employed and cash income are assessed very differently."
        >
          <ChoiceGroup
            value={a.incomeType}
            onChange={(incomeType) => pick({ incomeType })}
            options={[
              { value: "salaried", label: "Salaried", sub: "Monthly pay from an employer" },
              { value: "self_employed", label: "Self-employed", sub: "Business or professional income" },
              { value: "informal", label: "Informal / gig / cash", sub: "Daily or irregular earnings" },
              { value: "mixed", label: "A mix of these" },
            ]}
          />
        </QuestionShell>
      );

    case "income":
      return (
        <QuestionShell
          label={
            a.incomeType === "salaried"
              ? "What's your usual monthly take-home pay?"
              : "What do you typically earn in a month?"
          }
          hint="What actually reaches you in a normal month, after tax and deductions."
        >
          <MoneyInput
            autoFocus
            value={a.monthlyIncome}
            onChange={(monthlyIncome) => setAnswers({ monthlyIncome })}
            placeholder="1,10,000"
            suffix="/month"
            quickAdd={[30000, 60000, 110000, 250000]}
          />
        </QuestionShell>
      );

    case "stability":
      return (
        <QuestionShell
          label="How steady is that income?"
          hint="A swing month is what breaks an EMI, so this changes how much buffer we leave you."
        >
          <ChoiceGroup
            value={a.incomeStability}
            onChange={(incomeStability) => pick({ incomeStability })}
            options={[
              { value: "stable", label: "Steady every month" },
              { value: "varies_some", label: "Varies a little" },
              { value: "varies_a_lot", label: "Varies a lot", sub: "Good months and bad months" },
            ]}
          />
        </QuestionShell>
      );

    case "weakMonth":
      return (
        <QuestionShell
          label="What do you usually earn in a weaker but normal month?"
          hint="Not your worst month ever — a normal slow one. The EMI has to survive that month too, so we assess a blend weighted toward it."
        >
          <MoneyInput
            autoFocus
            value={a.weakMonthIncome}
            onChange={(weakMonthIncome) => setAnswers({ weakMonthIncome })}
            placeholder={a.monthlyIncome ? String(Math.round(a.monthlyIncome * 0.7)) : "40,000"}
            suffix="/month"
          />
          {a.weakMonthIncome && a.monthlyIncome && a.weakMonthIncome < a.monthlyIncome ? (
            <Note>
              We'll assess a blend of {formatINR(a.weakMonthIncome)} and {formatINR(a.monthlyIncome)} rather
              than your better month.
            </Note>
          ) : (
            <SkipButton onClick={() => setAnswers({ weakMonthIncome: null })}>
              Skip — my income doesn't really dip
            </SkipButton>
          )}
        </QuestionShell>
      );



    case "employmentTenure":
      return (
        <QuestionShell label="How long have you been working?" hint="Longer tenure earns a better starting rate.">
          <ChoiceGroup
            columns={2}
            value={a.employmentTenure}
            onChange={(employmentTenure) => pick({ employmentTenure })}
            options={[
              { value: "lt1", label: "Under 1 year" },
              { value: "1to3", label: "1–3 years" },
              { value: "3to5", label: "3–5 years" },
              { value: "5to10", label: "5+ years" },
            ]}
          />
        </QuestionShell>
      );

    case "variablePct":
      return (
        <QuestionShell
          label="How much of your pay is variable?"
          hint="Bonus, incentives and commissions — lenders count these only partly."
        >
          <ChoiceGroup
            columns={2}
            value={a.variableIncomePct}
            onChange={(variableIncomePct) => pick({ variableIncomePct })}
            options={[
              { value: "0", label: "None — fully fixed" },
              { value: "lt10", label: "Under 10%" },
              { value: "10to25", label: "10–25%" },
              { value: "gt25", label: "Over 25%" },
              { value: "unknown", label: "I'm not sure" },
            ]}
          />
        </QuestionShell>
      );

    case "businessVintage":
      return (
        <QuestionShell label="How long has your business been running?" hint="Vintage is what lenders trust most.">
          <ChoiceGroup
            columns={2}
            value={a.businessVintage}
            onChange={(businessVintage) => pick({ businessVintage })}
            options={[
              { value: "lt1", label: "Under 1 year" },
              { value: "1to3", label: "1–3 years" },
              { value: "3to5", label: "3–5 years" },
              { value: "5to10", label: "5–10 years" },
              { value: "10plus", label: "10+ years" },
            ]}
          />
        </QuestionShell>
      );

    case "documented":
      return (
        <QuestionShell
          label="How much of your income is visible in your ITR?"
          hint="Lenders size a loan on documented income, not on cash takings. Both matter, differently."
        >
          <MoneyInput
            value={a.documentedAnnualIncome}
            onChange={(documentedAnnualIncome) => setAnswers({ documentedAnnualIncome })}
            placeholder="4,20,000"
            suffix="/year"
          />
          {a.documentedAnnualIncome ? (
            <Note>
              About {formatINR(a.documentedAnnualIncome / 12)}/month documented, against{" "}
              {formatINR(a.monthlyIncome)}/month you actually earn.
            </Note>
          ) : (
            <SkipButton onClick={() => setAnswers({ documentedAnnualIncome: null })}>
              I don't know / nothing documented
            </SkipButton>
          )}
        </QuestionShell>
      );

    case "collateral":
      return (
        <QuestionShell
          label="Do you have property or gold you could pledge?"
          hint="Collateral usually moves you to a cheaper secured loan. We'll price it that way if you do."
        >
          <ChoiceGroup
            value={a.hasCollateral === null ? null : a.hasCollateral ? "yes" : "no"}
            onChange={(v) => {
              setAnswers({
                hasCollateral: v === "yes",
                collateralValue: v === "yes" ? a.collateralValue : null,
              });
              if (v === "no") onAnswered();
            }}
            options={[
              { value: "yes", label: "Yes, I could pledge something" },
              { value: "no", label: "No" },
            ]}
          />
        </QuestionShell>
      );

    case "collateralValue":
      return (
        <QuestionShell
          label="Roughly what is it worth today?"
          hint="A lender will typically lend a fraction of this value, so it caps what they can offer."
        >
          <MoneyInput
            autoFocus
            value={a.collateralValue}
            onChange={(collateralValue) => setAnswers({ collateralValue })}
            placeholder="45,00,000"
            quickAdd={[500000, 2000000, 4500000]}
          />
          <SkipButton onClick={() => setAnswers({ hasCollateral: false, collateralValue: null })}>
            Skip — I'd rather not pledge it
          </SkipButton>
        </QuestionShell>
      );

    case "collateralLoan":
      return (
        <QuestionShell
          label="Does that property or gold already have a loan on it?"
          hint="An asset that is already mortgaged or pledged has less free value, so a lender can lend less against it."
        >
          <ChoiceGroup
            columns={1}
            value={a.collateralHasLoan}
            onChange={(collateralHasLoan) => pick({ collateralHasLoan })}
            options={[
              { value: "no", label: "No, it's free of any loan" },
              { value: "yes", label: "Yes, a loan is already running on it" },
              { value: "unknown", label: "I'm not sure" },
            ]}
          />
          <Note>
            Collateral raises what a lender may sanction. It never raises what your household can afford to
            repay each month — those stay two separate numbers.
          </Note>
        </QuestionShell>
      );



    case "highCostDebt":
      return (
        <QuestionShell
          label={`Is any loan of yours charging over ${HIGH_COST_DEBT_RATE_THRESHOLD}% a year?`}
          hint="App loans and card EMIs often are. Clearing these frees more room than a new loan gives you."
        >
          <ChoiceGroup
            value={a.highCostDebt === null ? null : a.highCostDebt ? "yes" : "no"}
            onChange={(v) => pick({ highCostDebt: v === "yes" })}
            options={[
              { value: "yes", label: "Yes", sub: "App loans or very high rates" },
              { value: "no", label: "No" },
            ]}
          />
        </QuestionShell>
      );

    case "bounce":
      return (
        <QuestionShell
          label="Have you missed or bounced any loan or card payment?"
          hint="An honest answer here protects you — it's the single biggest pricing penalty, and hiding it doesn't remove it from your record."
        >
          <ChoiceGroup
            columns={1}
            value={a.recentBounce}
            onChange={(recentBounce) =>
              pick({
                recentBounce,
                bounceCount: recentBounce === "no" || recentBounce === "unknown" ? null : a.bounceCount,
              })
            }
            options={[
              { value: "no", label: "No, never" },
              { value: "yes_3m", label: "Yes, in the last 3 months" },
              { value: "yes_older", label: "Yes, earlier in the past year" },
              { value: "unknown", label: "I'm not sure" },
            ]}
          />
        </QuestionShell>
      );

    case "bounceCount":
      return (
        <QuestionShell
          label="How many payments have you missed in the last year?"
          hint="One slip reads very differently from a pattern, so this changes how conservative we are."
        >
          <PlainInput
            autoFocus
            value={a.bounceCount}
            onChange={(bounceCount) => setAnswers({ bounceCount })}
            placeholder="1"
            suffix="payments"
          />
          <SkipButton onClick={() => setAnswers({ bounceCount: null })}>I don't remember</SkipButton>
        </QuestionShell>
      );


    case "existingEmi":
      return (
        <QuestionShell
          label="What do you pay toward loans each month right now?"
          hint="Every EMI counts: car, home, personal, gold, app loans, card EMIs."
        >
          <MoneyInput
            autoFocus
            value={a.existingEmi}
            onChange={(existingEmi) => setAnswers({ existingEmi })}
            placeholder="14,000"
            suffix="/month"
          />
          <SkipButton
            onClick={() =>
              setAnswers({
                existingEmi: 0,
                activeLoans: 0,
                outstandingPrincipal: 0,
                highestExistingRate: null,
              })
            }
          >
            I have no EMIs
          </SkipButton>
        </QuestionShell>
      );

    case "debtCount":
      return (
        <QuestionShell label="How many loans are running?" hint="Several loans at once reads as stacked borrowing.">
          <PlainInput
            autoFocus
            value={a.activeLoans}
            onChange={(activeLoans) => setAnswers({ activeLoans })}
            placeholder="2"
            suffix="loans"
          />
          <SkipButton onClick={() => setAnswers({ activeLoans: null })}>I'd rather not say</SkipButton>
        </QuestionShell>
      );

    case "debtOutstanding":
      return (
        <QuestionShell
          label="Roughly how much is still outstanding on them?"
          hint="A rough total is fine — it tells us how long your current EMIs will run."
        >
          <MoneyInput
            value={a.outstandingPrincipal}
            onChange={(outstandingPrincipal) => setAnswers({ outstandingPrincipal })}
            placeholder="3,00,000"
          />
          <SkipButton onClick={() => setAnswers({ outstandingPrincipal: null })}>I don't know</SkipButton>
        </QuestionShell>
      );

    case "debtRate":
      return (
        <QuestionShell
          label="What's the highest rate among them?"
          hint="If something is priced very high, refinancing it beats borrowing more."
        >
          <ChoiceGroup
            columns={2}
            value={a.highestExistingRate}
            onChange={(highestExistingRate) =>
              pick({
                highestExistingRate,
                highCostDebt:
                  highestExistingRate === "24to30" || highestExistingRate === "gt30"
                    ? true
                    : highestExistingRate === "unknown"
                      ? a.highCostDebt
                      : false,
              })
            }
            options={[
              { value: "lt12", label: "Under 12%" },
              { value: "12to18", label: "12–18%" },
              { value: "18to24", label: "18–24%" },
              { value: "24to30", label: "24–30%" },
              { value: "gt30", label: "Over 30%" },
              { value: "unknown", label: "I don't know" },
            ]}
          />
        </QuestionShell>
      );

    case "family":
      return (
        <QuestionShell
          label="Are you married or partnered?"
          hint="We ask only because a second earner — and a second set of essentials — changes what is genuinely free for an EMI."
        >
          <ChoiceGroup
            columns={1}
            value={a.maritalStatus}
            onChange={(maritalStatus) => pick({ maritalStatus })}
            options={[
              { value: "single", label: "No" },
              { value: "married", label: "Yes", sub: "We'll ask about your spouse's income next" },
              { value: "prefer_not", label: "I'd rather not say" },
            ]}
          />
          <Note>
            Being married is neither a plus nor a minus here. We only count income that reliably reaches your
            household, and costs you actually pay.
          </Note>
        </QuestionShell>
      );

    case "dependentsAny":
      return (
        <QuestionShell
          label="Does anyone depend on this income besides you?"
          hint="Anyone whose essentials you cover, whether or not they live with you."
        >
          <ChoiceGroup
            columns={1}
            value={a.hasDependents}
            onChange={(hasDependents) =>
              pick({
                hasDependents,
                dependentTypes: hasDependents === "yes" ? a.dependentTypes : null,
                numberOfDependents: hasDependents === "yes" ? a.numberOfDependents : null,
                childrenCount: hasDependents === "yes" ? a.childrenCount : null,
              })
            }
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No, just me" },
              { value: "unknown", label: "I'd rather not say" },
            ]}
          />
        </QuestionShell>
      );

    case "dependentsWho":
      return (
        <QuestionShell
          label="Who depends on you?"
          hint="Pick everyone that applies. We never assume this from your marital status."
        >
          <MultiChoice
            value={a.dependentTypes ?? []}
            onChange={(dependentTypes) =>
              setAnswers({
                dependentTypes,
                childrenCount: dependentTypes.includes("children") ? a.childrenCount : null,
              })
            }
            options={[
              { value: "children", label: "Children" },
              { value: "parents", label: "Parents" },
              { value: "siblings", label: "Siblings" },
              { value: "other_family", label: "Spouse or partner not earning" },
              { value: "other", label: "Someone else" },
            ]}
          />
        </QuestionShell>
      );

    case "dependents":
      return (
        <QuestionShell
          label="How many people in total depend on you?"
          hint="Don't count yourself. This tells us how thin the same income is spread."
        >
          <ChoiceGroup
            columns={4}
            value={a.numberOfDependents}
            onChange={(numberOfDependents) => pick({ numberOfDependents })}
            options={[
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3" },
              { value: "4plus", label: "4 or more" },
            ]}
          />
        </QuestionShell>
      );

    case "children":
      return (
        <QuestionShell label="How many children do you support?" hint="School-going or younger.">
          <ChoiceGroup
            columns={3}
            value={a.childrenCount}
            onChange={(childrenCount) => pick({ childrenCount })}
            options={[
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3plus", label: "3+" },
            ]}
          />
          <Note>
            Children are never a penalty here. What they actually cost shows up in your household expenses on
            the next screens, and nowhere else.
          </Note>
        </QuestionShell>
      );



    case "spouse":
      return (
        <QuestionShell
          label="Does your spouse contribute to household money?"
          hint="We only count income that reliably reaches your household."
        >
          <ChoiceGroup
            columns={1}
            value={a.spouseContributes}
            onChange={(spouseContributes) => pick({ spouseContributes })}
            options={[
              { value: "regular", label: "Yes, every month" },
              { value: "sometimes", label: "Sometimes / irregular" },
              { value: "no", label: "No" },
              { value: "prefer_not", label: "I'd rather not say" },
            ]}
          />
        </QuestionShell>
      );

    case "spouseIncome":
      return (
        <QuestionShell
          label="What does your spouse earn each month?"
          hint="We won't treat all of it as available — the next question decides how much of it we count."
        >
          <MoneyInput
            autoFocus
            value={a.spouseIncome}
            onChange={(spouseIncome) => setAnswers({ spouseIncome })}
            placeholder="30,000"
            suffix="/month"
            quickAdd={[15000, 30000, 60000]}
          />
          <SkipButton onClick={() => setAnswers({ spouseIncome: null })}>I'd rather not say</SkipButton>
        </QuestionShell>
      );

    case "spouseShare":
      return (
        <QuestionShell
          label="How much of that reaches household expenses?"
          hint="Money that goes to their own loans, family or savings is not available for your EMI."
        >
          <ChoiceGroup
            columns={2}
            value={a.spouseReliableContribution}
            onChange={(spouseReliableContribution) => pick({ spouseReliableContribution })}
            options={[
              { value: "most", label: "Most of it" },
              { value: "half", label: "About half" },
              { value: "smaller", label: "A smaller part" },
              { value: "unsure", label: "I'm not sure" },
            ]}
          />
        </QuestionShell>
      );

    case "expenses":
      return (
        <QuestionShell
          label="What does your household spend each month?"
          hint="Fill in what you know — leave the rest blank. Anything you skip is replaced with a small safety allowance, not zero."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(EXPENSE_LABELS) as ExpenseCategory[]).map((k) => (
              <Field key={k} label={EXPENSE_LABELS[k]} optional>
                <MoneyInput
                  value={a.expenses[k]}
                  onChange={(v) => setAnswers({ expenses: { ...a.expenses, [k]: v } })}
                  placeholder="0"
                  suffix="/month"
                />
              </Field>
            ))}
          </div>
          <Note>
            Include what your children and dependents cost inside these lines — school fees under education,
            their food under food — so nothing is counted twice. Excludes the loan EMIs and insurance we ask
            about separately.
          </Note>

        </QuestionShell>
      );

    case "cardDebt":
      return (
        <QuestionShell
          label="Are you carrying a credit card balance or app loan?"
          hint="Revolving balances are the most expensive money most households hold."
        >
          <ChoiceGroup
            columns={2}
            value={a.hasCardDebt === null ? null : a.hasCardDebt ? "yes" : "no"}
            onChange={(v) => pick({ hasCardDebt: v === "yes" })}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </QuestionShell>
      );

    case "cardDebtAmount":
      return (
        <QuestionShell
          label="What do you pay towards it each month?"
          hint="The amount that actually leaves your account, including minimum dues."
        >
          <MoneyInput
            autoFocus
            value={a.cardDebtMonthly}
            onChange={(cardDebtMonthly) => setAnswers({ cardDebtMonthly })}
            placeholder="8,000"
            suffix="/month"
            quickAdd={[3000, 8000, 20000]}
          />
        </QuestionShell>
      );

    case "cardDebtBalance":
      return (
        <QuestionShell
          label="How much is still outstanding, and what does it cost?"
          hint="A balance that rolls over is the most expensive money in most households — clearing it frees more room than a new loan gives you."
        >
          <div className="space-y-5">
            <Field label="Balance outstanding" optional>
              <MoneyInput
                value={a.cardDebtOutstanding}
                onChange={(cardDebtOutstanding) => setAnswers({ cardDebtOutstanding })}
                placeholder="35,000"
                quickAdd={[10000, 35000, 100000]}
              />
            </Field>
            <Field label="Rate it charges" optional>
              <ChoiceGroup
                columns={2}
                value={a.cardDebtRate}
                onChange={(cardDebtRate) =>
                  setAnswers({
                    cardDebtRate,
                    highCostDebt:
                      cardDebtRate === "24to30" || cardDebtRate === "gt30" ? true : a.highCostDebt,
                  })
                }
                options={[
                  { value: "lt12", label: "Under 12%" },
                  { value: "12to18", label: "12–18%" },
                  { value: "18to24", label: "18–24%" },
                  { value: "24to30", label: "24–30%" },
                  { value: "gt30", label: "Over 30%" },
                  { value: "unknown", label: "I don't know" },
                ]}
              />
            </Field>
          </div>
          <SkipButton onClick={() => setAnswers({ cardDebtOutstanding: null, cardDebtRate: "unknown" })}>
            I don't know the balance
          </SkipButton>
        </QuestionShell>
      );



    case "insurance":
      return (
        <QuestionShell
          label="Do you pay insurance premiums?"
          hint="Insurance is protection, never debt — it only affects how much cash is free each month."
        >
          <ChoiceGroup
            columns={1}
            value={a.hasInsurance}
            onChange={(hasInsurance) => pick({ hasInsurance })}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No cover at all", sub: "We'll flag this as a risk, not a rate factor" },
              { value: "unknown", label: "I don't know" },
            ]}
          />
        </QuestionShell>
      );

    case "insuranceDetail":
      return (
        <QuestionShell
          label="Roughly what do the premiums come to?"
          hint="Monthly equivalent — divide a yearly premium by 12. Leave blank what you don't have."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Health" optional>
              <MoneyInput
                value={a.insuranceHealth}
                onChange={(insuranceHealth) => setAnswers({ insuranceHealth })}
                placeholder="0"
                suffix="/month"
              />
            </Field>
            <Field label="Life / term" optional>
              <MoneyInput
                value={a.insuranceLife}
                onChange={(insuranceLife) => setAnswers({ insuranceLife })}
                placeholder="0"
                suffix="/month"
              />
            </Field>
            <Field label="Other" optional>
              <MoneyInput
                value={a.insuranceOther}
                onChange={(insuranceOther) => setAnswers({ insuranceOther })}
                placeholder="0"
                suffix="/month"
              />
            </Field>
          </div>
        </QuestionShell>
      );

    case "commitments":
      return (
        <QuestionShell
          label="Any other fixed monthly commitments?"
          hint="Chit fund, recurring deposit, maintenance, alimony, money sent home — anything you can't easily stop."
        >
          <ChoiceGroup
            columns={2}
            value={a.hasOtherCommitments === null ? null : a.hasOtherCommitments ? "yes" : "no"}
            onChange={(v) => pick({ hasOtherCommitments: v === "yes" })}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </QuestionShell>
      );

    case "commitmentsAmount":
      return (
        <QuestionShell label="How much do they add up to each month?">
          <MoneyInput
            autoFocus
            value={a.otherFixedCommitments}
            onChange={(otherFixedCommitments) => setAnswers({ otherFixedCommitments })}
            placeholder="6,000"
            suffix="/month"
            quickAdd={[2000, 6000, 15000]}
          />
        </QuestionShell>
      );

    case "savings":
      return (
        <QuestionShell
          label="How long could your savings cover essentials?"
          hint="This is the difference between a tight month and a missed EMI."
        >
          <ChoiceGroup
            columns={2}
            value={a.emergencySavings}
            onChange={(emergencySavings) => pick({ emergencySavings })}
            options={[
              { value: "lt1", label: "Under a month" },
              { value: "1to3", label: "1–3 months" },
              { value: "3to6", label: "3–6 months" },
              { value: "6plus", label: "6+ months" },
              { value: "unknown", label: "I'd rather not say" },
            ]}
          />
        </QuestionShell>
      );

    case "age":
      return (
        <QuestionShell
          label="How old are you?"
          hint="Age caps how long a lender will let the loan run, which changes the EMI on the same amount."
        >
          <PlainInput autoFocus value={a.age} onChange={(age) => setAnswers({ age })} placeholder="29" suffix="years" />
        </QuestionShell>
      );

    case "credit":
      return (
        <QuestionShell label="Do you know your credit score?">
          <ChoiceGroup
            value={a.creditKnown}
            onChange={(creditKnown) => {
              setAnswers({ creditKnown, creditScore: creditKnown === "yes" ? a.creditScore : null });
              if (creditKnown !== "yes") onAnswered();
            }}
            options={[
              { value: "yes", label: "Yes, I know it" },
              { value: "no", label: "No, I've never checked" },
              { value: "prefer_not", label: "I'd rather not say" },
            ]}
          />
          <Note>
            An unknown score is not a bad score. We simply have less information, so your rate range stays
            wider instead of guessing against you.
          </Note>
        </QuestionShell>
      );

    case "creditScore":
      return (
        <QuestionShell label="What's your score?" hint="Anywhere from 300 to 900. A rough recall is fine.">
          <PlainInput
            autoFocus
            value={a.creditScore}
            onChange={(creditScore) => setAnswers({ creditScore })}
            placeholder="780"
          />
          <SkipButton onClick={() => setAnswers({ creditKnown: "no", creditScore: null })}>
            Actually, I don't know it
          </SkipButton>
        </QuestionShell>
      );

    case "offer":
      return (
        <QuestionShell
          label="Has a lender already quoted you something?"
          hint="If yes, we'll check it against the fair range for your profile and work out its real all-in cost."
        >
          <ChoiceGroup
            value={a.hasOffer === null ? null : a.hasOffer ? "yes" : "no"}
            onChange={(v) => {
              setAnswers({ hasOffer: v === "yes" });
              if (v === "no") onAnswered();
            }}
            options={[
              { value: "yes", label: "Yes, I have a quote" },
              { value: "no", label: "Not yet" },
            ]}
          />
        </QuestionShell>
      );

    case "offerDetail":
      return (
        <QuestionShell label="What does the quote say?" hint="Copy it straight from the sanction letter or message.">
          <div className="space-y-5">
            <Field label="Interest rate quoted">
              <PlainInput
                step="0.1"
                value={a.offerRate}
                onChange={(offerRate) => setAnswers({ offerRate })}
                placeholder="13.5"
                suffix="% per year"
              />
            </Field>
            <Field label="Amount offered">
              <MoneyInput value={a.offerAmount} onChange={(offerAmount) => setAnswers({ offerAmount })} placeholder="8,00,000" />
            </Field>
            <Field label="Tenure">
              <PlainInput
                value={a.offerTenureMonths}
                onChange={(offerTenureMonths) => setAnswers({ offerTenureMonths })}
                placeholder="48"
                suffix="months"
              />
            </Field>
            <Field label="Processing fee" optional>
              <MoneyInput value={a.offerFee} onChange={(offerFee) => setAnswers({ offerFee })} placeholder="12,000" />
            </Field>
          </div>
        </QuestionShell>
      );

    default:
      return null;
  }
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">
        {label}
        {optional ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">optional</span> : null}
      </p>
      {children}
    </div>
  );
}

/**
 * A pick-many control. Used where the honest answer is a list — several kinds of
 * dependents, for instance — instead of forcing a single choice.
 */
function MultiChoice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T[];
  onChange: (next: T[]) => void;
  options: { value: T; label: string; sub?: string }[];
}) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={`rounded-xl border px-4 py-3.5 text-left text-sm transition-colors ${
              on ? "border-primary bg-primary/15 shadow-card" : "border-input hover:border-foreground/30"
            }`}
          >
            <span className="font-medium">{o.label}</span>
            {o.sub ? <span className="mt-0.5 block text-xs text-muted-foreground">{o.sub}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
