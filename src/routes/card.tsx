import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight, Printer, RotateCcw } from "lucide-react";
import { Page } from "@/components/SiteShell";
import { runAssessment } from "@/calculations/engine";
import { resetAnswers, useAnswers } from "@/lib/store";
import { formatINR, formatINRBand, formatPct } from "@/lib/inr";

export const Route = createFileRoute("/card")({
  head: () => ({
    meta: [
      { title: "Borrower Negotiation Card — Borrower Copilot" },
      {
        name: "description",
        content:
          "A printable one-page negotiation card: your target amount, fair rate band, EMI ceiling, APR estimate and the five questions to ask any lender.",
      },
      { property: "og:title", content: "Borrower Negotiation Card — Borrower Copilot" },
      {
        property: "og:description",
        content: "Take your numbers with you when you talk to a lender.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CardPage,
});

const ASK_LENDER = [
  "What is the APR, not just the interest rate?",
  "What processing and other upfront charges apply?",
  "What amount will actually be disbursed to me?",
  "Show me the full repayment schedule.",
  "What happens to my EMI if the rate rises by 2%?",
];

function CardPage() {
  const a = useAnswers();
  const navigate = useNavigate();
  const ready = a.purpose !== null && a.amount !== null && a.monthlyIncome !== null;
  const r = useMemo(() => (ready ? runAssessment(a) : null), [a, ready]);

  if (!ready || !r) {
    return (
      <Page>
        <div className="mx-auto max-w-xl px-5 py-24 text-center">
          <h1 className="text-3xl">Nothing to print yet</h1>
          <p className="mt-3 text-muted-foreground">Answer a few questions first and we'll build your card.</p>
          <Link
            to="/assess"
            className="mt-7 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
          >
            Start the questionnaire <ArrowRight className="size-4" />
          </Link>
        </div>
      </Page>
    );
  }

  const verdictLabel =
    r.verdict.value === "BORROW" ? "BORROW" : r.verdict.value === "BORROW_LESS" ? "BORROW LESS" : "DON'T BORROW";
  const verdictLine =
    r.verdict.value === "BORROW"
      ? "This borrowing fits my income, within the limits below."
      : r.verdict.value === "BORROW_LESS"
        ? "I can borrow, but less than I first asked for."
        : "On these numbers this loan does not fit my income.";

  return (
    <Page>
      <div className="mx-auto max-w-[52rem] px-5 py-8 sm:py-12">
        <div className="no-print flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Printer className="size-4" /> Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={() => {
              resetAnswers();
              navigate({ to: "/" });
            }}
            className="inline-flex items-center gap-2 rounded-md px-3 py-3 text-sm text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-4" /> Start over
          </button>
          <Link to="/results" className="ml-auto text-sm text-muted-foreground underline underline-offset-4">
            Back to full result
          </Link>
        </div>
        <p className="no-print mt-2 text-xs text-muted-foreground">
          In the print dialog choose “Save as PDF” — the card is laid out to fit a single page. On a phone,
          screenshot the card below.
        </p>

        <article className="print-card mt-5 border border-border bg-card shadow-card">
          {/* Masthead */}
          <header className="border-b-2 border-foreground px-6 pb-4 pt-6 sm:px-9">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0">
                <p className="eyebrow">Borrower Copilot</p>
                <h1 className="mt-1 font-display text-[1.8rem] leading-none sm:text-[2.3rem]">
                  Borrower Negotiation Card
                </h1>
              </div>
              <p className="num shrink-0 pt-1 text-right text-[0.7rem] leading-tight text-muted-foreground">
                Prepared
                <br />
                {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
            <p className="mt-2 text-sm">Take this with you when you talk to a lender.</p>
          </header>

          {/* Recommendation */}
          <section className="border-b border-border px-6 py-5 sm:px-9">
            <p className="eyebrow">My recommendation</p>
            <div className="mt-1 grid gap-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-baseline sm:gap-5">
              <p className="font-display text-[2.1rem] leading-none tracking-tight sm:text-[2.6rem]">
                {verdictLabel}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">{verdictLine}</p>
            </div>
          </section>

          {/* Key figures — the negotiation ledger */}
          <section className="border-b border-border px-6 py-5 sm:px-9">
            <p className="eyebrow">My numbers</p>
            <dl className="mt-3 grid gap-x-9 sm:grid-cols-2">
              <Row
                label="Amount I should target"
                value={formatINRBand(r.safeAmount.value.low, r.safeAmount.value.high, false)}
                strong
              />
              <Row
                label="Lender may sanction"
                value={formatINRBand(r.lenderAmount.value.low, r.lenderAmount.value.high, false)}
              />
              <Row
                label="Fair rate for my profile"
                value={`${formatPct(r.fairRate.value.low)} – ${formatPct(r.fairRate.value.high)}`}
                strong
              />
              <Row
                label="Estimated APR (rate + charges)"
                value={`${formatPct(r.apr.value.low)} – ${formatPct(r.apr.value.high)}`}
              />
              <Row label="Maximum EMI I will accept" value={`${formatINR(r.safeEmi.value)} / month`} strong />
              <Row label="Assessed over" value={`${r.assumedTenureMonths} months`} />
            </dl>
          </section>

          {/* Household picture — the reason the EMI ceiling is where it is. */}
          <section className="border-b border-border px-6 py-5 sm:px-9">
            <p className="eyebrow">My household picture</p>
            <dl className="mt-3 divide-y divide-border/70">
              <Row
                label="Reliable monthly household income"
                value={`${formatINR(r.cashFlow.reliableHouseholdIncome)} / month`}
              />
              <Row
                label="Household expenses, insurance and existing commitments"
                value={`${formatINR(
                  r.cashFlow.householdExpenses +
                    r.cashFlow.childrenExpenses +
                    r.cashFlow.insurance +
                    r.cashFlow.existingEmi +
                    r.cashFlow.cardDebt +
                    r.cashFlow.otherCommitments,
                )} / month`}
              />
              <Row label="Left over each month" value={`${formatINR(r.cashFlow.freeCashFlow)} / month`} />
            </dl>
            <div className="mt-4 border border-caution bg-caution-soft px-4 py-3">
              <p className="eyebrow">Why this EMI ceiling?</p>
              <p className="num mt-1 font-display text-xl">
                Do not cross {formatINR(r.safeEmi.value)} / month
              </p>
              <p className="mt-1.5 text-sm leading-relaxed">
                {r.bindingConstraint === "cash_flow"
                  ? `Lending rules would allow about ${formatINR(r.foirSafeEmi)} a month, but after what my household actually spends only ${formatINR(r.cashFlow.emiCapFromCashFlow)} a month fits comfortably${r.safeEmi.value < r.cashFlow.emiCapFromCashFlow ? `, and allowing for a bad month brings my ceiling to ${formatINR(r.safeEmi.value)}` : ""}.`
                  : `After my household spending there is ${formatINR(r.cashFlow.freeCashFlow)} a month free, and a safer debt burden limit puts my ceiling at ${formatINR(r.safeEmi.value)} a month.`}
              </p>
            </div>
          </section>

          {/* Stress case */}
          <section className="border-b border-border px-6 py-5 sm:px-9">
            <p className="eyebrow">Stress case — {r.stress.kind === "income" ? "if income drops" : "if the rate rises"}</p>
            <div className="mt-2 grid gap-x-9 gap-y-1 sm:grid-cols-[auto_auto_minmax(0,1fr)] sm:items-baseline">
              <p className="num font-display text-xl">{formatINR(r.stress.emi)} / month</p>
              <p className="num text-sm text-muted-foreground">
                Burden {Math.round(r.stress.foir * 100)}% · safer target {Math.round(r.stress.safeFoirTarget * 100)}%
              </p>
            </div>
            <p className="mt-2 text-sm leading-relaxed">{r.stress.note}</p>
          </section>

          {/* Reasons */}
          <section className="border-b border-border px-6 py-5 sm:px-9">
            <p className="eyebrow">Why — three reasons</p>
            <ol className="mt-2 space-y-1.5 text-sm leading-relaxed">
              {r.reasons.slice(0, 3).map((x, i) => (
                <li key={x} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-1">
                  <span className="num text-muted-foreground">{i + 1}.</span>
                  <span>{x}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Ask the lender */}
          <section className="px-6 py-5 sm:px-9">
            <p className="eyebrow">Ask the lender — five questions</p>
            <ol className="mt-2 divide-y divide-border/70 border-y border-border/70">
              {ASK_LENDER.map((q, i) => (
                <li key={q} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-1 py-2 text-sm leading-snug">
                  <span className="num text-muted-foreground">{i + 1}.</span>
                  <span>{q}</span>
                </li>
              ))}
            </ol>

            <p className="mt-4 border-l-2 border-caution bg-caution-soft px-4 py-2.5 text-sm font-medium">
              Never compare loan offers using the headline interest rate alone.
            </p>

            <footer className="mt-4 border-t border-border pt-3 text-[0.68rem] leading-relaxed text-muted-foreground">
              Borrower Copilot · Educational self-assessment, not a loan approval or financial guarantee. Figures
              are estimates from self-reported information using prototype affordability rules — not lender policy.
            </footer>
          </section>
        </article>
      </div>
    </Page>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-dotted border-border py-2 last:border-b-0">
      <dt className="min-w-0 text-sm text-muted-foreground">{label}</dt>
      <dd className={`num shrink-0 font-display leading-none ${strong ? "text-[1.35rem]" : "text-[1.1rem]"}`}>
        {value}
      </dd>
    </div>
  );
}
