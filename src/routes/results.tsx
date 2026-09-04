import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, PencilLine, ShieldAlert, TrendingDown } from "lucide-react";
import { CompareBar, ConfidencePill, Page, ResultSection, Why } from "@/components/SiteShell";
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
          <h1 className="font-display text-3xl">We need your answers first</h1>
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
  const meta = {
    BORROW: {
      label: "You can borrow this",
      short: "BORROW",
      tone: "border-positive/30 bg-positive-soft",
      icon: CheckCircle2,
    },
    BORROW_LESS: {
      label: "Borrow less than you planned",
      short: "BORROW LESS",
      tone: "border-caution/30 bg-caution-soft",
      icon: TrendingDown,
    },
    DONT_BORROW: {
      label: "Don't borrow right now",
      short: "DON'T BORROW",
      tone: "border-danger/30 bg-danger-soft",
      icon: ShieldAlert,
    },
  }[r.verdict.value];

  // Scale every amount bar against the largest number on the page so the gap is honest.
  const amountMax = Math.max(r.lenderAmount.value.high, r.safeAmount.value.high, a.amount ?? 0);
  const emiMax = Math.max(r.lenderEmi.value, r.safeEmi.value, r.requestedEmi, r.stress.emi);
  const recommended = r.tenureTable.find((row) => row.emi <= r.safeEmi.value) ?? null;

  return (
    <Page>
      <div className="mx-auto max-w-3xl px-5 pb-32 pt-8 sm:pb-16 sm:pt-12">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <p className="eyebrow truncate">Your borrowing position</p>
          <Link
            to="/assess"
            className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            <PencilLine className="size-3.5" /> Edit answers
          </Link>
        </div>

        {/* Verdict hero */}
        <div className={`mt-4 rounded-2xl border ${meta.tone} px-6 py-7 sm:px-9 sm:py-9`}>
          <div className="flex items-center gap-2.5 text-sm font-medium">
            <meta.icon className="size-5 shrink-0" />
            <span className="eyebrow">{meta.short}</span>
          </div>
          <h1 className="mt-3 font-display text-[2rem] leading-[1.1] tracking-tight sm:text-[2.75rem]">
            {meta.label}
          </h1>
          <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed">{r.verdict.reason}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <ConfidencePill level={r.confidence.overall} label="Overall" />
            <ConfidencePill level={r.confidence.amount} label="Amount" />
            <ConfidencePill level={r.confidence.rate} label="Rate" />
          </div>
        </div>

        {r.confidence.notes.length ? (
          <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            {r.confidence.notes.map((n) => (
              <li key={n} className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {n}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-12 space-y-14">
          {/* 01 — Should you borrow */}
          <ResultSection step={1} title="Should you borrow?" question="The honest answer, before any number.">
            <div className="panel p-6">
              <ul className="space-y-2.5 text-sm">
                {r.reasons.map((x) => (
                  <li key={x} className="flex gap-2.5 text-muted-foreground">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="min-w-0">{x}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-xl bg-surface p-4">
                <p className="text-sm font-medium">
                  {r.verdict.value === "DONT_BORROW" ? "What to do instead" : "Before you sign"}
                </p>
                <ol className="mt-2.5 space-y-2 text-sm text-muted-foreground">
                  {r.nextSteps.map((s, i) => (
                    <li key={s} className="flex gap-2.5">
                      <span className="num shrink-0 text-primary">{i + 1}.</span>
                      <span className="min-w-0">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </ResultSection>

          {/* 02 — How much */}
          <ResultSection
            step={2}
            title="How much?"
            question="What a lender may give you and what you should take are two different numbers."
          >
            <div className="panel space-y-6 p-6">
              <div className="space-y-5">
                <CompareBar
                  label="A lender may consider"
                  caption={formatINRBand(r.lenderAmount.value.low, r.lenderAmount.value.high)}
                  value={r.lenderAmount.value.high}
                  max={amountMax}
                />
                <CompareBar
                  emphasis
                  tone="safe"
                  label="You should aim for"
                  caption={formatINRBand(r.safeAmount.value.low, r.safeAmount.value.high)}
                  value={r.safeAmount.value.high}
                  max={amountMax}
                />
                <CompareBar
                  label="You asked for"
                  caption={formatINR(a.amount)}
                  value={a.amount ?? 0}
                  max={amountMax}
                  tone={(a.amount ?? 0) > r.safeAmount.value.high ? "caution" : "neutral"}
                />
              </div>
              <p className="text-sm leading-relaxed">
                <span className="font-medium">Negotiate with the safer number.</span>{" "}
                <span className="text-muted-foreground">
                  Assessed over {r.assumedTenureMonths} months.
                  {r.tenureNote ? ` ${r.tenureNote}` : ""}
                </span>
              </p>
              {r.secured ? (
                <p className="rounded-xl border border-primary/25 bg-positive-soft/60 p-4 text-sm leading-relaxed">
                  <span className="font-medium">Consider a secured product. </span>
                  {r.secured}
                </p>
              ) : null}
              <div>
                <Why question="Why is the lender's number higher?">
                  Lenders may work to a higher debt-service threshold ({Math.round(LENDER_FOIR[type] * 100)}% of
                  income for your income type) than the borrower-side safety rule (
                  {Math.round(SAFE_FOIR[type] * 100)}%), and they don't discount for the fragility signals you
                  told us about. {r.lenderAmount.reason}
                </Why>
                <Why question="How did we get your safer range?">
                  {r.safeAmount.reason} {r.safeEmi.reason}
                </Why>
              </div>
            </div>
          </ResultSection>

          {/* 03 — Fair rate */}
          <ResultSection step={3} title="What's a fair rate?" question="Your benchmark before you walk in.">
            <div className="panel p-6">
              <p className="num font-display text-[2.5rem] leading-none sm:text-[3rem]">
                {formatPct(r.fairRate.value.low)}–{formatPct(r.fairRate.value.high)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Indicative benchmark for your profile — not an offer or guaranteed rate.
              </p>

              {/* Band gauge: shows where the range sits, and where a quote falls against it. */}
              <RateGauge
                low={r.fairRate.value.low}
                high={r.fairRate.value.high}
                quoted={r.offerComparison?.rate ?? null}
              />

              <div className="mt-6 rounded-xl bg-surface p-4">
                <p className="text-sm font-medium">Estimated all-in cost</p>
                <p className="num mt-1 font-display text-2xl">
                  APR {formatPct(r.apr.value.low)}–{formatPct(r.apr.value.high)}
                </p>
                <dl className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <Row k="Loan amount" v={formatINR(a.amount)} />
                  <Row
                    k={r.feeIsQuoted ? "Processing fee (your quote)" : "Assumed processing fee"}
                    v={formatINR(r.upfrontFee)}
                  />
                  <Row k="Net amount you'd receive" v={formatINR(r.netDisbursed)} />
                </dl>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{r.apr.reason}</p>
              </div>

              {r.offerComparison ? (
                <div className="mt-4 rounded-xl border border-border p-4">
                  <p className="text-sm font-medium">Your quote vs the fair range</p>
                  <dl className="mt-2.5 space-y-1.5 text-sm text-muted-foreground">
                    <Row k="Quoted rate" v={formatPct(r.offerComparison.rate)} />
                    <Row k="Fee" v={formatINR(r.offerComparison.feeRupees)} />
                    <Row k="Actually disbursed" v={formatINR(r.offerComparison.netDisbursed)} />
                    <Row k="Estimated APR of this quote" v={formatPct(r.offerComparison.apr)} />
                  </dl>
                  <p className="mt-3 text-sm leading-relaxed">{r.offerComparison.verdict}</p>
                </div>
              ) : null}

              <Why question="What's driving this range?">{r.fairRate.reason}</Why>
            </div>
          </ResultSection>

          {/* 04 — EMI ceiling */}
          <ResultSection step={4} title="What EMI should you agree to?" question="Your walk-away line.">
            <div className="panel p-6">
              <p className="eyebrow">Do not cross</p>
              <p className="num mt-1.5 font-display text-[2.5rem] leading-none sm:text-[3rem]">
                {formatINR(r.safeEmi.value)}
                <span className="text-lg text-muted-foreground">/month</span>
              </p>

              <div className="mt-6 space-y-5">
                <CompareBar
                  emphasis
                  tone="safe"
                  label="Your safe ceiling"
                  caption={`${formatINR(r.safeEmi.value)}/mo`}
                  value={r.safeEmi.value}
                  max={emiMax}
                />
                <CompareBar
                  label="EMI on the amount you asked for"
                  caption={`${formatINR(r.requestedEmi)}/mo`}
                  value={r.requestedEmi}
                  max={emiMax}
                  tone={r.requestedEmi > r.safeEmi.value ? "caution" : "neutral"}
                />
                <CompareBar
                  label="What a lender might stretch you to"
                  caption={`${formatINR(r.lenderEmi.value)}/mo`}
                  value={r.lenderEmi.value}
                  max={emiMax}
                />
                <CompareBar
                  label={`Stress case — ${r.stress.kind === "income" ? "income drops" : "rate rises"}`}
                  caption={`${formatINR(r.stress.emi)}/mo`}
                  value={r.stress.emi}
                  max={emiMax}
                  tone="danger"
                />
              </div>

              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                The amount you asked for takes {Math.round(r.foirNow * 100)}% of your assessed income once
                existing EMIs are counted.
              </p>

              <div className="mt-5 rounded-xl bg-caution-soft p-4">
                <p className="text-sm font-medium">
                  If {r.stress.kind === "income" ? "income drops" : "the rate rises"}
                </p>
                <div className="num mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span>Stress EMI {formatINR(r.stress.emi)}</span>
                  <span>Burden {Math.round(r.stress.foir * 100)}%</span>
                  <span>Safer target {Math.round(r.stress.safeFoirTarget * 100)}%</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed">{r.stress.note}</p>
              </div>

              <Why question={`Why ${formatINR(r.safeEmi.value)}?`}>{r.safeEmi.reason}</Why>
            </div>
          </ResultSection>

          {/* 05 — Tenure */}
          <ResultSection
            step={5}
            title="How long should it run?"
            question="A longer tenure lowers the EMI and raises what you finally repay."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {r.tenureTable.map((row) => {
                const fits = row.emi <= r.safeEmi.value;
                const isPick = recommended?.months === row.months;
                return (
                  <div
                    key={row.months}
                    className={`rounded-xl border p-5 ${
                      isPick ? "border-primary bg-positive-soft/60" : "border-border bg-card"
                    }`}
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <p className="min-w-0 truncate font-display text-lg">{row.months} months</p>
                      {isPick ? (
                        <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[0.7rem] font-medium text-primary-foreground">
                          Recommended
                        </span>
                      ) : (
                        <span
                          className={`shrink-0 text-xs ${fits ? "text-positive" : "text-caution"}`}
                        >
                          {fits ? "Within ceiling" : "Above ceiling"}
                        </span>
                      )}
                    </div>
                    <p className="num mt-3 font-display text-2xl">
                      {formatINR(row.emi)}
                      <span className="text-sm text-muted-foreground">/month</span>
                    </p>
                    <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
                      <Row k="Total interest" v={formatINR(row.totalInterest)} />
                      <Row k="Total repaid" v={formatINR(row.totalRepayment)} />
                    </dl>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Pick the shortest tenure whose EMI still sits under your ceiling — that's the cheapest loan you
              can comfortably carry.
            </p>
          </ResultSection>
        </div>

        <div className="mt-12 hidden flex-wrap items-center gap-4 sm:flex">
          <Link
            to="/card"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground shadow-card transition-opacity hover:opacity-90"
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

      {/* Sticky mobile CTA — the card is the thing you take to the lender */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-5 pb-5 pt-3 backdrop-blur sm:hidden">
        <Link
          to="/card"
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
        >
          Open my negotiation card <ArrowRight className="size-4" />
        </Link>
      </div>
    </Page>
  );
}

/** Visual placement of the fair range, plus a marker for any quote the borrower has. */
function RateGauge({ low, high, quoted }: { low: number; high: number; quoted: number | null }) {
  const scaleLow = Math.max(0, Math.floor(Math.min(low, quoted ?? low) - 3));
  const scaleHigh = Math.ceil(Math.max(high, quoted ?? high) + 3);
  const span = scaleHigh - scaleLow || 1;
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - scaleLow) / span) * 100))}%`;
  return (
    <div className="mt-6">
      <div className="relative h-2.5 w-full rounded-full bg-muted">
        <div
          className="absolute inset-y-0 rounded-full bg-positive"
          style={{ left: pos(low), right: `calc(100% - ${pos(high)})` }}
        />
        {quoted !== null ? (
          <span
            className="absolute -top-1 size-4.5 -translate-x-1/2 rounded-full border-2 border-background bg-foreground"
            style={{ left: pos(quoted) }}
            aria-label={`Your quote: ${formatPct(quoted)}`}
          />
        ) : null}
      </div>
      <div className="num mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{formatPct(scaleLow, 0)}</span>
        <span className="text-positive">fair range {formatPct(low)}–{formatPct(high)}</span>
        <span>{formatPct(scaleHigh, 0)}</span>
      </div>
      {quoted !== null ? (
        <p className="mt-1.5 text-xs text-muted-foreground">Dot marks your quoted {formatPct(quoted)}.</p>
      ) : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="min-w-0">{k}</dt>
      <dd className="num shrink-0 text-foreground">{v}</dd>
    </div>
  );
}
