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

  return (
    <Page>
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <div className="no-print flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Printer className="size-4" /> Print card
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md border border-input px-5 py-3 text-sm font-medium transition-colors hover:bg-surface"
          >
            Save as PDF
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

        <article className="print-card mt-6 rounded-xl border border-border bg-card p-6 shadow-card sm:p-9">
          <header className="border-b border-border pb-5">
            <h1 className="text-3xl leading-tight sm:text-[2.35rem]">BORROWER NEGOTIATION CARD</h1>
            <p className="mt-2 text-sm font-medium">Take this with you when you talk to a lender.</p>
          </header>

          <section className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Field label="My recommendation" value={verdictLabel} big />
            <Field label="Amount I should target" value={formatINRBand(r.safeAmount.value.low, r.safeAmount.value.high, false)} big />
            <Field
              label="Lender may sanction"
              value={formatINRBand(r.lenderAmount.value.low, r.lenderAmount.value.high, false)}
            />
            <Field
              label="Fair rate for my profile"
              value={`${formatPct(r.fairRate.value.low)} – ${formatPct(r.fairRate.value.high)}`}
            />
            <Field label="Maximum EMI" value={`${formatINR(r.safeEmi.value)}/month`} />
            <Field
              label="Estimated APR"
              value={`${formatPct(r.apr.value.low)} – ${formatPct(r.apr.value.high)}`}
            />
          </section>

          <section className="mt-7 border-t border-border pt-5">
            <h2 className="text-xl">Why</h2>
            <ul className="mt-2.5 space-y-1.5 text-sm leading-relaxed">
              {r.reasons.slice(0, 3).map((x) => (
                <li key={x} className="flex gap-2">
                  <span className="text-primary">•</span>
                  {x}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6 border-t border-border pt-5">
            <h2 className="text-xl">Ask the lender</h2>
            <ol className="mt-2.5 space-y-1.5 text-sm leading-relaxed">
              {ASK_LENDER.map((q, i) => (
                <li key={q} className="flex gap-2">
                  <span className="num shrink-0 text-primary">{i + 1}.</span>
                  {q}
                </li>
              ))}
            </ol>
          </section>

          <p className="mt-6 rounded-md border border-caution/30 bg-caution-soft px-4 py-3 text-sm font-medium">
            Never compare loan offers using the headline interest rate alone.
          </p>

          <footer className="mt-5 border-t border-border pt-4 text-[0.7rem] leading-relaxed text-muted-foreground">
            Borrower Copilot · Educational self-assessment, not a loan approval or financial guarantee.
            Figures are estimates from self-reported information, using prototype affordability rules — not
            lender policy. Stress case: {r.stress.note}
          </footer>
        </article>
      </div>
    </Page>
  );
}

function Field({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={`num mt-1 font-display ${big ? "text-3xl" : "text-2xl"} leading-tight`}>{value}</p>
    </div>
  );
}
