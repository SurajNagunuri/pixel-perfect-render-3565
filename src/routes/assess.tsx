import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { Page } from "@/components/SiteShell";
import { ChoiceGroup, MoneyInput, PlainInput, QuestionShell, SkipButton } from "@/components/inputs";
import { sampleBorrowers } from "@/data/sampleBorrowers";
import { replaceAnswers, setAnswers, useAnswers } from "@/lib/store";
import { formatINR } from "@/lib/inr";
import { CREDIT_SCORE_RANGE } from "@/rules/rules";
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
  | "existingEmi"
  | "debtDetail"
  | "expenses"
  | "age"
  | "credit"
  | "salaried"
  | "selfEmployed"
  | "informal"
  | "savings"
  | "offer";

function visibleSteps(a: Answers): StepId[] {
  const steps: StepId[] = ["purpose", "amount", "incomeType", "income", "existingEmi"];
  if ((a.existingEmi ?? 0) > 0) steps.push("debtDetail");
  steps.push("expenses", "age", "credit");
  if (a.incomeType === "salaried" || a.incomeType === "mixed") steps.push("salaried");
  if (a.incomeType === "self_employed" || a.incomeType === "mixed") steps.push("selfEmployed");
  if (a.incomeType === "informal") steps.push("informal");
  steps.push("savings", "offer");
  return steps;
}

function Assess() {
  const a = useAnswers();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const steps = useMemo(() => visibleSteps(a), [a]);
  const step = steps[Math.min(index, steps.length - 1)];

  function next() {
    const err = validate(step, a);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (index >= steps.length - 1) {
      navigate({ to: "/results" });
      return;
    }
    setIndex(index + 1);
  }

  function back() {
    setError(null);
    if (index === 0) navigate({ to: "/" });
    else setIndex(index - 1);
  }

  const progress = ((index + 1) / steps.length) * 100;

  return (
    <Page>
      <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
        <div className="flex items-center justify-between text-sm">
          <span className="eyebrow">
            Step {index + 1} of {steps.length}
          </span>
          <select
            aria-label="Load sample borrower"
            className="rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-muted-foreground"
            defaultValue=""
            onChange={(e) => {
              const s = sampleBorrowers.find((b) => b.id === e.target.value);
              if (s) {
                replaceAnswers(s.answers);
                navigate({ to: "/results" });
              }
            }}
          >
            <option value="">Load sample borrower…</option>
            {sampleBorrowers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name.split(",")[0]}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-10">
          <StepBody step={step} a={a} />
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-2 rounded-md border border-input px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back
          </button>
          <button
            type="button"
            onClick={next}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {index >= steps.length - 1 ? "See my position" : "Continue"}
            <ArrowRight className="size-4" />
          </button>
        </div>
        {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}

        <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
          Nothing you type leaves your browser. Read{" "}
          <Link to="/rules" className="underline underline-offset-4">
            how we calculate this
          </Link>
          .
        </p>
      </div>
    </Page>
  );
}

function validate(step: StepId, a: Answers): string | null {
  switch (step) {
    case "purpose":
      return a.purpose ? null : "Please pick what you're borrowing for.";
    case "amount":
      if (a.amount === null) return "Please enter the amount you're planning to borrow.";
      if (a.amount <= 0) return "The amount must be greater than zero.";
      if (a.amount > 100000000) return "That amount looks too large — please check it.";
      return null;
    case "incomeType":
      return a.incomeType ? null : "Please pick your income type.";
    case "income":
      if (a.monthlyIncome === null) return "Please enter your usual monthly income.";
      if (a.monthlyIncome <= 0) return "Monthly income must be greater than zero.";
      if (!a.incomeStability) return "Please tell us how stable that income is.";
      return null;
    case "existingEmi":
      return a.existingEmi === null ? "Enter your current EMIs, or choose 'I don't have any EMIs'." : null;
    case "expenses":
      if (a.householdExpenses === null) return "Please estimate your monthly household spending.";
      if (a.householdExpenses < 0) return "Expenses cannot be negative.";
      return null;
    case "age":
      return validateAge(a.age);
    case "credit":
      if (!a.creditKnown) return "Please choose one option.";
      if (a.creditKnown === "yes") {
        if (a.creditScore === null) return "Please enter your credit score, or choose another option.";
        if (a.creditScore < CREDIT_SCORE_RANGE.min || a.creditScore > CREDIT_SCORE_RANGE.max)
          return `Credit scores run from ${CREDIT_SCORE_RANGE.min} to ${CREDIT_SCORE_RANGE.max}.`;
      }
      return null;
    case "selfEmployed":
      return a.hasCollateral === null ? "Please answer the collateral question." : null;
    case "informal":
      return a.recentBounce === null ? "Please answer the missed-payment question." : null;
    case "offer":
      if (a.hasOffer === null) return "Please choose yes or no.";
      if (a.hasOffer && (a.offerRate === null || a.offerAmount === null || a.offerTenureMonths === null))
        return "Please fill in the rate, amount and tenure of the quote.";
      return null;
    default:
      return null;
  }
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-md bg-surface px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function StepBody({ step, a }: { step: StepId; a: Answers }) {
  switch (step) {
    case "purpose":
      return (
        <QuestionShell
          label="What are you borrowing for?"
          hint="The purpose changes the realistic rate band and tenure, so it's the first thing we ask."
        >
          <ChoiceGroup
            columns={2}
            value={a.purpose}
            onChange={(purpose) => setAnswers({ purpose })}
            options={[
              { value: "home", label: "Home" },
              { value: "personal", label: "Personal / wedding / education" },
              { value: "vehicle", label: "Vehicle" },
              { value: "business", label: "Business / working capital" },
              { value: "against_property", label: "Against property" },
              { value: "gold", label: "Gold" },
              { value: "other", label: "Other" },
            ]}
          />
        </QuestionShell>
      );

    case "amount":
      return (
        <QuestionShell
          label="How much are you planning to borrow?"
          hint="Your best estimate is fine. We'll tell you whether it sits inside your safer range."
        >
          <MoneyInput
            value={a.amount}
            onChange={(amount) => setAnswers({ amount })}
            placeholder="8,00,000"
          />
          {a.amount ? <Note>You entered {formatINR(a.amount)}.</Note> : null}
        </QuestionShell>
      );

    case "incomeType":
      return (
        <QuestionShell
          label="What type of income do you have?"
          hint="Lenders assess salaried, self-employed and cash income very differently."
        >
          <ChoiceGroup
            value={a.incomeType}
            onChange={(incomeType) => setAnswers({ incomeType })}
            options={[
              { value: "salaried", label: "Salaried" },
              { value: "self_employed", label: "Self-employed" },
              { value: "informal", label: "Informal / gig / cash-based" },
              { value: "mixed", label: "Mixed income" },
            ]}
          />
        </QuestionShell>
      );

    case "income":
      return (
        <QuestionShell
          label={
            a.incomeType === "salaried"
              ? "What is your usual monthly take-home income?"
              : "What is your typical monthly income?"
          }
          hint="After tax and deductions — what actually reaches you in a normal month."
        >
          <MoneyInput
            value={a.monthlyIncome}
            onChange={(monthlyIncome) => setAnswers({ monthlyIncome })}
            placeholder="1,10,000"
            suffix="/month"
          />
          <div className="pt-2">
            <p className="mb-2.5 text-sm font-medium">How stable is that income?</p>
            <ChoiceGroup
              value={a.incomeStability}
              onChange={(incomeStability) => setAnswers({ incomeStability })}
              options={[
                { value: "stable", label: "Stable" },
                { value: "varies_some", label: "Varies somewhat" },
                { value: "varies_a_lot", label: "Varies significantly" },
              ]}
            />
          </div>
        </QuestionShell>
      );

    case "existingEmi":
      return (
        <QuestionShell
          label="How much do you currently pay toward loans each month?"
          hint="Include every EMI: car, home, personal, gold, app loans, credit-card EMIs."
        >
          <MoneyInput
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
            I don't currently have any EMIs
          </SkipButton>
        </QuestionShell>
      );

    case "debtDetail":
      return (
        <QuestionShell
          label="Tell us about the loans you already have"
          hint="Expensive existing debt changes the recommendation more than almost anything else."
        >
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium">Number of active loans</p>
              <PlainInput
                value={a.activeLoans}
                onChange={(activeLoans) => setAnswers({ activeLoans })}
                placeholder="1"
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Approximate outstanding principal</p>
              <MoneyInput
                value={a.outstandingPrincipal}
                onChange={(outstandingPrincipal) => setAnswers({ outstandingPrincipal })}
                placeholder="3,00,000"
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Highest interest rate among them</p>
              <ChoiceGroup
                columns={2}
                value={a.highestExistingRate}
                onChange={(highestExistingRate) =>
                  setAnswers({
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
                  { value: "unknown", label: "Don't know" },
                ]}
              />
            </div>
          </div>
        </QuestionShell>
      );

    case "expenses":
      return (
        <QuestionShell
          label="About how much does your household spend each month, excluding existing EMIs?"
          hint="Rent, food, utilities, school fees, transport, insurance and regular household spending."
        >
          <MoneyInput
            value={a.householdExpenses}
            onChange={(householdExpenses) => setAnswers({ householdExpenses })}
            placeholder="45,000"
            suffix="/month"
          />
        </QuestionShell>
      );

    case "age":
      return (
        <QuestionShell
          label="How old are you?"
          hint="Age caps the tenure a lender will offer, which changes the EMI on the same amount."
        >
          <PlainInput value={a.age} onChange={(age) => setAnswers({ age })} placeholder="29" suffix="years" />
        </QuestionShell>
      );

    case "credit":
      return (
        <QuestionShell label="Do you know your credit score?">
          <ChoiceGroup
            value={a.creditKnown}
            onChange={(creditKnown) =>
              setAnswers({ creditKnown, creditScore: creditKnown === "yes" ? a.creditScore : null })
            }
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "prefer_not", label: "Prefer not to say" },
            ]}
          />
          {a.creditKnown === "yes" ? (
            <PlainInput
              value={a.creditScore}
              onChange={(creditScore) => setAnswers({ creditScore })}
              placeholder="780"
            />
          ) : null}
          <Note>
            We won't treat an unknown score as a bad score. We simply have less information, so your rate
            range stays wider.
          </Note>
        </QuestionShell>
      );

    case "salaried":
      return (
        <QuestionShell
          label="A little more about your job"
          hint="Tenure and how much of your pay is variable both change your assessed income."
        >
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium">How long have you been employed?</p>
              <ChoiceGroup
                columns={2}
                value={a.employmentTenure}
                onChange={(employmentTenure) => setAnswers({ employmentTenure })}
                options={[
                  { value: "lt1", label: "Under 1 year" },
                  { value: "1to3", label: "1–3 years" },
                  { value: "3to5", label: "3–5 years" },
                  { value: "5to10", label: "5+ years" },
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">
                What percentage of your monthly income is variable?
              </p>
              <ChoiceGroup
                columns={2}
                value={a.variableIncomePct}
                onChange={(variableIncomePct) => setAnswers({ variableIncomePct })}
                options={[
                  { value: "0", label: "0% — fully fixed" },
                  { value: "lt10", label: "Under 10%" },
                  { value: "10to25", label: "10–25%" },
                  { value: "gt25", label: "Over 25%" },
                  { value: "unknown", label: "Don't know" },
                ]}
              />
            </div>
          </div>
        </QuestionShell>
      );

    case "selfEmployed":
      return (
        <QuestionShell
          label="About your business"
          hint="Lenders lend against documented income, not cash income. Both matter, differently."
        >
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium">How long has the business been operating?</p>
              <ChoiceGroup
                columns={2}
                value={a.businessVintage}
                onChange={(businessVintage) => setAnswers({ businessVintage })}
                options={[
                  { value: "lt1", label: "Under 1 year" },
                  { value: "1to3", label: "1–3 years" },
                  { value: "3to5", label: "3–5 years" },
                  { value: "5to10", label: "5–10 years" },
                  { value: "10plus", label: "10+ years" },
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">
                Approximately how much annual income is visible in your ITR / financial records?
              </p>
              <MoneyInput
                value={a.documentedAnnualIncome}
                onChange={(documentedAnnualIncome) => setAnswers({ documentedAnnualIncome })}
                placeholder="4,20,000"
                suffix="/year"
              />
              {a.documentedAnnualIncome ? (
                <Note>
                  That's about {formatINR(a.documentedAnnualIncome / 12)}/month of documented income —
                  separate from your cash/business income of {formatINR(a.monthlyIncome)}/month.
                </Note>
              ) : (
                <div className="mt-2">
                  <SkipButton onClick={() => setAnswers({ documentedAnnualIncome: null })}>
                    I don't know / nothing documented
                  </SkipButton>
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">
                Do you have property or other collateral you could pledge?
              </p>
              <ChoiceGroup
                value={a.hasCollateral === null ? null : a.hasCollateral ? "yes" : "no"}
                onChange={(v) =>
                  setAnswers({ hasCollateral: v === "yes", collateralValue: v === "yes" ? a.collateralValue : null })
                }
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
              />
              {a.hasCollateral ? (
                <div className="mt-3">
                  <p className="mb-2 text-sm font-medium">Estimated current value</p>
                  <MoneyInput
                    value={a.collateralValue}
                    onChange={(collateralValue) => setAnswers({ collateralValue })}
                    placeholder="45,00,000"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </QuestionShell>
      );

    case "informal":
      return (
        <QuestionShell
          label="A few questions about your current loans"
          hint="These are the signals that most affect whether borrowing now is safe."
        >
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium">
                Do any of your existing loans charge roughly more than 24% a year?
              </p>
              <ChoiceGroup
                value={a.highCostDebt === null ? null : a.highCostDebt ? "yes" : "no"}
                onChange={(v) => setAnswers({ highCostDebt: v === "yes" })}
                options={[
                  { value: "yes", label: "Yes — app loans / very high rates" },
                  { value: "no", label: "No" },
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">
                Have you missed or bounced an EMI recently?
              </p>
              <ChoiceGroup
                value={a.recentBounce}
                onChange={(recentBounce) => setAnswers({ recentBounce })}
                options={[
                  { value: "no", label: "No" },
                  { value: "yes_3m", label: "Yes, within the last 3 months" },
                  { value: "unknown", label: "Don't know" },
                ]}
              />
            </div>
          </div>
        </QuestionShell>
      );

    case "savings":
      return (
        <QuestionShell
          label="How many months of essential expenses could your savings cover?"
          hint="This decides how much buffer we leave you. It's the difference between a tight month and a missed EMI."
        >
          <ChoiceGroup
            columns={2}
            value={a.emergencySavings}
            onChange={(emergencySavings) => setAnswers({ emergencySavings })}
            options={[
              { value: "lt1", label: "Less than 1 month" },
              { value: "1to3", label: "1–3 months" },
              { value: "3to6", label: "3–6 months" },
              { value: "6plus", label: "6+ months" },
              { value: "unknown", label: "Prefer not to say" },
            ]}
          />
        </QuestionShell>
      );

    case "offer":
      return (
        <QuestionShell
          label="Have you already received a loan quote?"
          hint="If yes, we'll compare it against the fair range for your profile and work out its real all-in cost."
        >
          <ChoiceGroup
            value={a.hasOffer === null ? null : a.hasOffer ? "yes" : "no"}
            onChange={(v) => setAnswers({ hasOffer: v === "yes" })}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No, not yet" },
            ]}
          />
          {a.hasOffer ? (
            <div className="space-y-4 pt-2">
              <div>
                <p className="mb-2 text-sm font-medium">Interest rate quoted</p>
                <PlainInput
                  step="0.1"
                  value={a.offerRate}
                  onChange={(offerRate) => setAnswers({ offerRate })}
                  placeholder="13.5"
                  suffix="% per year"
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Processing fee</p>
                <MoneyInput
                  value={a.offerFee}
                  onChange={(offerFee) => setAnswers({ offerFee })}
                  placeholder="12,000"
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Tenure</p>
                <PlainInput
                  value={a.offerTenureMonths}
                  onChange={(offerTenureMonths) => setAnswers({ offerTenureMonths })}
                  placeholder="48"
                  suffix="months"
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Amount offered</p>
                <MoneyInput
                  value={a.offerAmount}
                  onChange={(offerAmount) => setAnswers({ offerAmount })}
                  placeholder="8,00,000"
                />
              </div>
            </div>
          ) : null}
        </QuestionShell>
      );

    default:
      return null;
  }
}
