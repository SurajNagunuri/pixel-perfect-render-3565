import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/SiteShell";
import {
  CONFIDENCE_THRESHOLDS,
  DEFAULT_TENURES,
  FEE_ASSUMPTIONS,
  LENDER_FOIR,
  RATE_BANDS,
  SAFETY_HAIRCUTS,
  SAFE_FOIR,
  STRESS_ASSUMPTIONS,
} from "@/rules/rules";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "How we calculate this — Borrower Copilot" },
      {
        name: "description",
        content:
          "The FOIR assumptions, indicative rate bands, fee treatment, stress assumptions, confidence rules and limitations behind every Borrower Copilot number.",
      },
      { property: "og:title", content: "How we calculate this — Borrower Copilot" },
      {
        property: "og:description",
        content: "Transparent prototype rules: what is source-backed, what is our judgement.",
      },
    ],
  }),
  component: Rules,
});

const labels: Record<string, string> = {
  salaried: "Salaried",
  self_employed: "Self-employed",
  informal: "Informal / gig",
  mixed: "Mixed income",
};

function Rules() {
  return (
    <Page>
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <p className="eyebrow">Rules &amp; assumptions</p>
        <h1 className="mt-3 text-4xl sm:text-5xl">How we calculate this</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Every number in this tool comes from your answers plus the rules on this page. Nothing is
          a black box, and nothing here is a regulatory requirement we invented.
        </p>

        <Section
          title="Debt-service (FOIR) assumptions"
          tag="Prototype judgement"
          body="We compare total monthly EMIs (existing plus new) against assessed monthly income. Two ceilings are used: a lender-style ceiling that answers 'what might they offer', and a safer borrower-side ceiling that answers 'what can you carry through a bad month'."
        >
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Income type</th>
                <th className="py-2 text-right font-medium">Lender-style ceiling</th>
                <th className="py-2 text-right font-medium">Safer borrower ceiling</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(SAFE_FOIR).map((k) => (
                <tr key={k} className="border-t border-border/70">
                  <td className="py-2">{labels[k]}</td>
                  <td className="num py-2 text-right">
                    {Math.round(LENDER_FOIR[k as keyof typeof LENDER_FOIR] * 100)}%
                  </td>
                  <td className="num py-2 text-right">
                    {Math.round(SAFE_FOIR[k as keyof typeof SAFE_FOIR] * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm font-medium">Prototype rule, not a lender approval policy.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            These are not RBI-mandated limits. Real lenders vary by product, city, profile and
            internal policy.
          </p>
        </Section>

        <Section
          title="Assessed income"
          tag="Prototype judgement"
          body="Self-employed income is assessed from documented (ITR) income rather than peak cash months; where nothing is documented we assess about 60% of stated cash income. Gig/cash income is assessed at about 85%. Salaried income with more than 25% variable pay is assessed at about 85%."
        />

        <Section
          title="Household cash flow"
          tag="Prototype judgement"
          body="We run two independent calculations and use whichever is lower. The first is a debt-service limit against assessed income. The second is your household cash flow: reliable income minus household expenses, children's costs, insurance premiums, existing EMIs, card or app loan payments and other fixed commitments — and we treat only about 60% of what's left as available for a new EMI."
        >
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>
              Insurance is protection, never debt: it reduces free cash but never changes the rate
              band.
            </li>
            <li>
              A spouse's income counts only to the extent it reliably reaches the household —
              regular counts in full, occasional at 60%, and only the share you say reaches
              household expenses.
            </li>
            <li>
              Children's costs and the education expense line overlap, so we count the larger of the
              two rather than adding both.
            </li>
            <li>
              Blank expense categories are never treated as zero: we hold back a small allowance
              (about 3% of income per missing category, 2% when insurance is unknown) and widen the
              range instead.
            </li>
          </ul>
        </Section>

        <Section
          title="Safe EMI haircuts"
          tag="Prototype judgement"
          body="After applying the safer ceiling, we reduce the remaining headroom for fragility signals, and cap the new EMI at 70% of household cash left after expenses and existing EMIs."
        >
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>
              Over 25% variable income: −{Math.round(SAFETY_HAIRCUTS.variableIncomeHigh * 100)}%
            </li>
            <li>
              Income varies significantly: −{Math.round(SAFETY_HAIRCUTS.incomeVariesALot * 100)}%
            </li>
            <li>Missed EMI within 3 months: −{Math.round(SAFETY_HAIRCUTS.recentBounce * 100)}%</li>
            <li>Under 1 month of savings: −{Math.round(SAFETY_HAIRCUTS.lowSavings * 100)}%</li>
            <li>Existing debt above 24%: −{Math.round(SAFETY_HAIRCUTS.highCostDebt * 100)}%</li>
            <li>
              Household expenses above 60% of income: −
              {Math.round(SAFETY_HAIRCUTS.stretchedHousehold * 100)}%
            </li>
          </ul>
        </Section>

        <Section
          title="EMI mathematics"
          tag="Source-backed rule"
          body="Standard reducing-balance EMI: EMI = P × r × (1+r)^n ÷ ((1+r)^n − 1), where r is the monthly rate and n the number of months. We invert the same formula to convert your safe EMI back into a principal."
        />

        <Section
          title="Indicative rate bands"
          tag="Prototype market estimate"
          body="We never return a single rate. We start from a broad band per product, then shift and widen it using credit score, income stability, tenure, collateral, documentation and repayment history. An unknown credit score widens the band — it never implies a poor score."
        >
          <ul className="grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
            {Object.values(RATE_BANDS).map((b) => (
              <li
                key={b.label}
                className="flex justify-between gap-3 border-b border-border/60 py-1"
              >
                <span>{b.label}</span>
                <span className="num text-foreground">
                  {b.low}%–{b.high}%
                </span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-b border-border/60 py-1">
              <span>Informal / high-risk unsecured</span>
              <span className="num text-foreground">18%–30%+</span>
            </li>
          </ul>
          <p className="mt-3 text-sm font-medium">
            Indicative benchmark — not an offer or guaranteed rate.
          </p>
        </Section>

        <Section
          title="Fees and APR"
          tag="Prototype judgement"
          body={`Interest rate and APR are different things. We estimate APR from the amount you'd actually receive after fees and the EMI schedule. If you haven't given us a quote, we assume a ${FEE_ASSUMPTIONS.assumedProcessingFeePct * 100}% processing fee and ${FEE_ASSUMPTIONS.otherUpfrontChargesPct * 100}% other upfront charges. This does not reproduce an official lender Key Fact Statement exactly — where fees are unknown, APR confidence is limited.`}
        />

        <Section
          title="Stress test"
          tag="Prototype judgement"
          body={`Every result includes one stress case. For variable or cash income we cut income by ${Math.round(STRESS_ASSUMPTIONS.incomeDropPct * 100)}%. Otherwise we raise the rate by ${STRESS_ASSUMPTIONS.rateIncreasePoints} percentage points and recompute the EMI and debt burden.`}
        />

        <Section
          title="Assumed tenure"
          tag="Prototype judgement"
          body={`Amount estimates assume a typical tenure per product — for example ${DEFAULT_TENURES.personal} months for a personal loan and ${DEFAULT_TENURES.home} months for a home loan. The tenure table on your result shows the trade-off between EMI and total interest.`}
        />

        <Section
          title="Confidence"
          tag="Prototype judgement"
          body={`Confidence reflects how much you told us, not how good a borrower you are. Core answers alone give Low confidence; more verified inputs move you to Medium or High (roughly ${Math.round(CONFIDENCE_THRESHOLDS.mediumMinAnswered * 100)}% and ${Math.round(CONFIDENCE_THRESHOLDS.highMinAnswered * 100)}% of the useful questions answered). An unknown credit score lowers rate confidence and widens the band; it is never read as bad credit.`}
        />

        <Section
          title="What this tool does not know"
          tag="Limitations"
          body="Bank underwriting policies, your bureau data, exact lender pricing, lender-specific fees unless you enter them, your future income, your exact household cash flow, and lender-specific eligibility criteria. Your actual offer may differ. This is an educational self-assessment, not a lender approval engine, and it does not predict approval."
        />

        <div className="mt-12">
          <Link
            to="/assess"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground"
          >
            Check my borrowing position
          </Link>
        </div>
      </div>
    </Page>
  );
}

function Section({
  title,
  tag,
  body,
  children,
}: {
  title: string;
  tag: string;
  body: string;
  children?: React.ReactNode;
}) {
  const tone =
    tag === "Source-backed rule"
      ? "bg-positive-soft text-positive"
      : tag === "Limitations"
        ? "bg-danger-soft text-danger"
        : "bg-accent text-accent-foreground";
  return (
    <section className="mt-10 border-t border-border pt-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl">{title}</h2>
        <span className={`rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${tone}`}>{tag}</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
