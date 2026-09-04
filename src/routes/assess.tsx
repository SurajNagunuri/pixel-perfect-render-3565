import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Info, Lock } from "lucide-react";
import { Page } from "@/components/SiteShell";
import { ChoiceGroup, MoneyInput, PlainInput, QuestionShell, SkipButton } from "@/components/inputs";
import { setAnswers, useAnswers } from "@/lib/store";
import { formatINR } from "@/lib/inr";
import { CREDIT_SCORE_RANGE, HIGH_COST_DEBT_RATE_THRESHOLD } from "@/rules/rules";
import { validateAge } from "@/calculations/engine";
import type { Answers } from "@/types";

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
  | "employmentTenure"
  | "variablePct"
  | "businessVintage"
  | "documented"
  | "collateral"
  | "collateralValue"
  | "highCostDebt"
  | "bounce"
  | "family"
  | "dependents"
  | "children"
  | "childrenSpend"
  | "spouse"
  | "spouseIncome"
  | "spouseShare"
  | "existingEmi"
  | "debtCount"
  | "debtOutstanding"
  | "debtRate"
  | "cardDebt"
  | "cardDebtAmount"
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
  employmentTenure: "Your income",
  variablePct: "Your income",
  businessVintage: "Your income",
  documented: "Your income",
  collateral: "Your income",
  collateralValue: "Your income",
  family: "Your household",
  dependents: "Your household",
  children: "Your household",
  childrenSpend: "Your household",
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
  insurance: "Your commitments",
  insuranceDetail: "Your commitments",
  commitments: "Your commitments",
  commitmentsAmount: "Your commitments",
  highCostDebt: "Your commitments",
  bounce: "Your commitments",
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
  "dependents",
  "children",
  "spouseShare",
];

/** Adaptive branching: a borrower only ever sees questions that change their result. */
function visibleSteps(a: Answers): StepId[] {
  const steps: StepId[] = ["purpose", "amount", "incomeType", "income", "stability"];

  if (a.incomeType === "salaried" || a.incomeType === "mixed") steps.push("employmentTenure", "variablePct");
  if (a.incomeType === "self_employed" || a.incomeType === "mixed") {
    steps.push("businessVintage", "documented", "collateral");
    if (a.hasCollateral === true) steps.push("collateralValue");
  }
  if (a.incomeType === "informal") steps.push("highCostDebt", "bounce");

  // Household shape: asked after income, because it changes cash-flow capacity, not pricing.
  steps.push("family", "dependents");
  const hasDependents = a.numberOfDependents !== null && a.numberOfDependents !== "0";
  if (a.maritalStatus === "married" || hasDependents) steps.push("children");
  if (a.childrenCount !== null && a.childrenCount !== "0") steps.push("childrenSpend");
  if (a.maritalStatus === "married") {
    steps.push("spouse");
    if (a.spouseContributes === "regular" || a.spouseContributes === "sometimes")
      steps.push("spouseIncome", "spouseShare");
  }
  steps.push("expenses");

  steps.push("existingEmi");
  if ((a.existingEmi ?? 0) > 0) steps.push("debtCount", "debtOutstanding", "debtRate");
  steps.push("cardDebt");
  if (a.hasCardDebt === true) steps.push("cardDebtAmount");

  steps.push("insurance");
  if (a.hasInsurance === "yes") steps.push("insuranceDetail");
  steps.push("commitments");
  if (a.hasOtherCommitments === true) steps.push("commitmentsAmount");

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
    case "collateral":
      return a.hasCollateral === null ? "Choose yes or no." : null;
    case "bounce":
      return a.recentBounce === null ? "Choose one option." : null;
    case "existingEmi":
      return a.existingEmi === null ? "Enter your current EMIs, or tap “I have no EMIs”." : null;
    case "expenses":
      if (a.householdExpenses === null) return "Estimate your monthly household spending.";
      if (a.householdExpenses < 0) return "Expenses cannot be negative.";
      return null;
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
          label="Have you missed or bounced an EMI recently?"
          hint="An honest answer here protects you — it's the single biggest pricing penalty."
        >
          <ChoiceGroup
            value={a.recentBounce}
            onChange={(recentBounce) => pick({ recentBounce })}
            options={[
              { value: "no", label: "No" },
              { value: "yes_3m", label: "Yes, in the last 3 months" },
              { value: "unknown", label: "I'm not sure" },
            ]}
          />
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

    case "expenses":
      return (
        <QuestionShell
          label="What does your household spend each month?"
          hint="Rent, food, utilities, fees, transport, insurance — everything except the EMIs you just told us about."
        >
          <MoneyInput
            autoFocus
            value={a.householdExpenses}
            onChange={(householdExpenses) => setAnswers({ householdExpenses })}
            placeholder="45,000"
            suffix="/month"
            quickAdd={[20000, 45000, 80000]}
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
