import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, PencilLine, ShieldAlert, TrendingDown } from "lucide-react";
import { ConfidencePill, Page, Why } from "@/components/SiteShell";
import { runAssessment } from "@/calculations/engine";
import { useAnswers } from "@/lib/store";
import { formatINR, formatINRBand, formatPct } from "@/lib/inr";
import { LENDER_FOIR, SAFE_FOIR } from "@/rules/rules";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Your borrowing position — Borrower Copilot" },
      {
        name: "description",
        content:
          "Your verdict, lender-likely sanction vs safe borrowing amount, fair rate band, APR estimate, EMI ceiling and stress case.",
      },
      { property: "og:title", content: "Your borrowing position — Borrower Copilot" },
      {
        property: "og:description",
        content: "Four answers with the reasoning behind every number, plus a printable negotiation card.",
      },
    ],
  }),
  component: Results,
});

function Results() {
  const a = useAnswers();
  const ready = a.purpose !== null && a.amount !== null && a.monthlyIncome !== null;
  const r = useMemo(() => (ready ? runAssessment(a) : null), [a, ready]);

  if (!ready || !r) {
    return (
      <Page>
        <div className="mx-auto max-w-xl px-5 py-24 text-center">
          <h1 className="text-3xl">We need your answers first</h1>
          <p className="mt-3 text-muted-foreground">
            Your answers live only in this browser tab, so there's nothing to show yet.
          </p>
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

  const type = a.incomeType ?? "salaried";
  const verdictMeta = {
    BORROW: {
      label: "BORROW",
      tone: "bg-positive-soft text-positive border-positive/30",
      icon: CheckCircle2,
    },
    BORROW_LESS: {
      label: "BORROW LESS",
      tone: "bg-caution-soft text-caution border-caution/30",
      icon: TrendingDown,
    },
    DONT_BORROW: {
      label: "DON'T BORROW",
      tone: "bg-danger-soft text-danger border-danger/30",
      icon: ShieldAlert,
    },
  }[r.verdict.value];

  return (
    <Page>
      <div className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Your borrowing position</p>
          <Link
            to="/assess"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            <PencilLine className="size-3.5" /> Edit my answers
          </Link>
        </div>

        {/* Verdict */}
        <div className={`mt-4 rounded-xl border ${verdictMeta.tone} px-6 py-7 sm:px-9 sm:py-9`}>
          <div className="flex items-center gap-3">
            <verdictMeta.icon className="size-6" />
            <h1 className="font-display text-4xl sm:text-5xl">{verdictMeta.label}</h1>
          </div>
          <p className="mt-4 max-w-3xl text-[0.98rem] leading-relaxed text-foreground">
            <span className="font-medium">Why this result: </span>
            {r.verdict.reason}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ConfidencePill level={r.confidence.overall} label="Overall confidence" />
            <ConfidencePill level={r.confidence.amount} label="Amount" />
            <ConfidencePill level={r.confidence.rate} label="Rate" />
          </div>
        </div>

        {r.confidence.notes.length ? (
          <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            {r.confidence.notes.map((n) => (
              <li key={n} className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {n}
              </li>
            ))}
          </ul>
        ) : null}

        {/* Four cards */}
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {/* Card 1 */}
          <section className="panel p-6">
            <p className="eyebrow">Card 1</p>
            <h2 className="mt-2 text-2xl">Should you borrow?</h2>
            <p className="mt-3 font-display text-3xl">{verdictMeta.label}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.verdict.reason}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {r.reasons.map((x) => (
                <li key={x} className="flex gap-2 text-muted-foreground">
                  <span className="text-primary">•</span>
                  {x}
                </li>
              ))}
            </ul>
            {r.verdict.value === "DONT_BORROW" ? (
              <div className="mt-5 rounded-lg bg-surface p-4">
                <p className="text-sm font-medium">What to do instead</p>
                <ol className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {r.nextSteps.map((s, i) => (
                    <li key={s} className="flex gap-2">
                      <span className="num text-primary">{i + 1}.</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="mt-5 rounded-lg bg-surface p-4">
                <p className="text-sm font-medium">Before you sign</p>
                <ol className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {r.nextSteps.map((s, i) => (
                    <li key={s} className="flex gap-2">
                      <span className="num text-primary">{i + 1}.</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          {/* Card 2 */}
          <section className="panel p-6">
            <p className="eyebrow">Card 2</p>
            <h2 className="mt-2 text-2xl">How much?</h2>
            <p className="mt-1 text-xs text-muted-foreground">These are two different questions.</p>
            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-border bg-surface px-4 py-4">
                <p className="text-sm text-muted-foreground">Lender may consider</p>
                <p className="num mt-1 font-display text-3xl text-muted-foreground">
                  {formatINRBand(r.lenderAmount.value.low, r.lenderAmount.value.high)}
                </p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-positive-soft/60 px-4 py-4">
                <p className="text-sm text-primary">You should aim for</p>
                <p className="num mt-1 font-display text-3xl">
                  {formatINRBand(r.safeAmount.value.low, r.safeAmount.value.high)}
                </p>
              </div>
              <p className="text-sm font-medium">Use the safer number when negotiating.</p>
              <p className="text-sm text-muted-foreground">
                You asked for {formatINR(a.amount)}. Assessed over {r.assumedTenureMonths} months.
              </p>
            </div>
            <Why question="Why is the lender number higher?">
              Because lenders may use a higher acceptable debt-service threshold (
              {Math.round(LENDER_FOIR[type] * 100)}% of income for your income type) than the borrower-side
              safety rule ({Math.round(SAFE_FOIR[type] * 100)}%), and they don't reduce for the fragility
              signals you told us about. {r.lenderAmount.reason}
            </Why>
            <Why question={`Why is my safer range ${formatINRBand(r.safeAmount.value.low, r.safeAmount.value.high)}?`}>
              {r.safeAmount.reason} {r.safeEmi.reason}
            </Why>
            {r.secured ? (
              <p className="mt-4 rounded-lg border border-primary/25 bg-positive-soft/50 p-4 text-sm leading-relaxed">
                <span className="font-medium">Consider a secured product. </span>
                {r.secured}
              </p>
            ) : null}
          </section>

          {/* Card 3 */}
          <section className="panel p-6">
            <p className="eyebrow">Card 3</p>
            <h2 className="mt-2 text-2xl">What's a fair rate?</h2>
            <p className="num mt-4 font-display text-4xl">
              {formatPct(r.fairRate.value.low)} – {formatPct(r.fairRate.value.high)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Indicative benchmark — not an offer or guaranteed rate.
            </p>

            <div className="mt-5 rounded-lg bg-surface p-4">
              <p className="text-sm font-medium">Estimated all-in cost</p>
              <p className="num mt-1 font-display text-2xl">
                APR {formatPct(r.apr.value.low)} – {formatPct(r.apr.value.high)}
              </p>
              <dl className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <Row k="Loan amount" v={formatINR(a.amount)} />
                <Row
                  k={a.hasOffer && a.offerFee !== null ? "Processing fee (your quote)" : "Assumed processing fee (1.5%)"}
                  v={formatINR(a.hasOffer && a.offerFee !== null ? a.offerFee : (a.amount ?? 0) * 0.015)}
                />
                <Row
                  k="Net amount you'd receive"
                  v={formatINR(
                    (a.amount ?? 0) -
                      (a.hasOffer && a.offerFee !== null ? a.offerFee : (a.amount ?? 0) * 0.015) -
                      (a.amount ?? 0) * 0.002,
                  )}
                />
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{r.apr.reason}</p>
            </div>

            {r.offerComparison ? (
              <div className="mt-4 rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Your quote vs the fair range</p>
                <dl className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  <Row k="Quoted rate" v={formatPct(r.offerComparison.rate)} />
                  <Row k="Fee" v={formatINR(r.offerComparison.feeRupees)} />
                  <Row k="Actually disbursed" v={formatINR(r.offerComparison.netDisbursed)} />
                  <Row k="Estimated APR of this quote" v={formatPct(r.offerComparison.apr)} />
                </dl>
                <p className="mt-3 text-sm">{r.offerComparison.verdict}</p>
              </div>
            ) : null}

            <Why question="What's driving this rate range?">{r.fairRate.reason}</Why>
          </section>

          {/* Card 4 */}
          <section className="panel p-6">
            <p className="eyebrow">Card 4</p>
            <h2 className="mt-2 text-2xl">What EMI should you agree to?</h2>
            <p className="num mt-4 font-display text-4xl">
              Do not cross {formatINR(r.safeEmi.value)}/month
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              The amount you asked for implies about {formatINR(r.requestedEmi)}/month over{" "}
              {r.assumedTenureMonths} months — that's {Math.round(r.foirNow * 100)}% of assessed income
              once existing EMIs are counted. A lender might stretch you to{" "}
              {formatINR(r.lenderEmi.value)}/month.
            </p>

            <div className="mt-5 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Tenure</th>
                    <th className="px-3 py-2.5 text-right font-medium">EMI</th>
                    <th className="px-3 py-2.5 text-right font-medium">Total interest</th>
                    <th className="px-3 py-2.5 text-right font-medium">Total repaid</th>
                  </tr>
                </thead>
                <tbody>
                  {r.tenureTable.map((row) => {
                    const ok = row.emi <= r.safeEmi.value;
                    return (
                      <tr key={row.months} className="border-t border-border/70">
                        <td className="px-3 py-2.5">{row.months}m</td>
                        <td className={`num px-3 py-2.5 text-right ${ok ? "text-positive" : "text-caution"}`}>
                          {formatINR(row.emi)}
                        </td>
                        <td className="num px-3 py-2.5 text-right text-muted-foreground">
                          {formatINR(row.totalInterest)}
                        </td>
                        <td className="num px-3 py-2.5 text-right text-muted-foreground">
                          {formatINR(row.totalRepayment)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Lower EMI vs higher total interest — a longer tenure is not automatically better. Pick the
              shortest tenure whose EMI still fits under your ceiling.
            </p>

            <div className="mt-5 rounded-lg bg-caution-soft p-4">
              <p className="text-sm font-medium">
                Stress case — {r.stress.kind === "income" ? "income drops 15%" : "rate rises 2 points"}
              </p>
              <div className="num mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span>Stress EMI: {formatINR(r.stress.emi)}</span>
                <span>Stress debt burden: {Math.round(r.stress.foir * 100)}%</span>
                <span>Safer target: {Math.round(r.stress.safeFoirTarget * 100)}%</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed">{r.stress.note}</p>
            </div>

            <Why question={`Why is my safe EMI ${formatINR(r.safeEmi.value)}?`}>{r.safeEmi.reason}</Why>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            to="/card"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-card transition-opacity hover:opacity-90"
          >
            Open my negotiation card <ArrowRight className="size-4" />
          </Link>
          <Link to="/rules" className="text-sm text-muted-foreground underline underline-offset-4">
            How we calculated this
          </Link>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
          Prototype rule, not a lender approval policy. Your actual offer may differ — we don't know bank
          underwriting policies, bureau data or lender-specific fees.
        </p>
      </div>
    </Page>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{k}</dt>
      <dd className="num text-foreground">{v}</dd>
    </div>
  );
}
