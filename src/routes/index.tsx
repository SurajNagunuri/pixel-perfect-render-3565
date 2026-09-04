import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  FileText,
  Gauge,
  ScrollText,
  ShieldCheck,
  Scale,
} from "lucide-react";
import { Page } from "@/components/SiteShell";
import { sampleBorrowers } from "@/data/sampleBorrowers";
import { replaceAnswers } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Borrower Copilot — Know your number before the lender does" },
      {
        name: "description",
        content:
          "Free self-assessment for Indian borrowers: should you borrow, how much a lender may sanction, your safe amount, a fair rate band, your EMI ceiling and a negotiation card.",
      },
      { property: "og:title", content: "Borrower Copilot — Know your number before the lender does" },
      {
        property: "og:description",
        content:
          "Decide how much to borrow, what EMI is safe and what rate is fair — before you walk into a lender.",
      },
    ],
  }),
  component: Landing,
});

const outputs = [
  {
    icon: Scale,
    title: "Borrow / Borrow less / Don't borrow",
    body: "A clear verdict with the reasoning spelled out — never a score, never a judgement.",
  },
  {
    icon: Gauge,
    title: "Lender-likely sanction",
    body: "What a lender might offer, using a higher debt-service threshold than you should accept.",
  },
  {
    icon: ShieldCheck,
    title: "Safe borrowing amount",
    body: "The amount you can carry through a bad month, not just the amount you'd be approved for.",
  },
  {
    icon: Calculator,
    title: "Fair rate + APR",
    body: "An indicative rate band for your profile, plus the all-in cost once fees are included.",
  },
  {
    icon: BadgeCheck,
    title: "EMI ceiling",
    body: "The monthly number you should not cross, with a stress case if income dips or rates rise.",
  },
  {
    icon: FileText,
    title: "Negotiation card",
    body: "A printable one-pager with your numbers and the five questions to ask the lender.",
  },
];

function Landing() {
  const navigate = useNavigate();

  function loadSample(id: string) {
    const s = sampleBorrowers.find((b) => b.id === id);
    if (!s) return;
    replaceAnswers(s.answers);
    navigate({ to: "/results" });
  }

  return (
    <Page>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-8 sm:pt-24">
        <div className="grid items-start gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="eyebrow">Borrower-side, not lender-side</p>
            <h1 className="mt-4 text-[2.6rem] leading-[1.05] sm:text-6xl">
              Know your number before the lender gives you theirs.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Borrower Copilot helps you decide how much to borrow, what EMI is safe, and what rate is
              fair — before you walk into a lender.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/assess"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3.5 text-base font-medium text-primary-foreground shadow-card transition-opacity hover:opacity-90"
              >
                Check my borrowing position
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/rules"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                <ScrollText className="size-4" /> How we calculate this
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              No login · No credit bureau pull · Nothing stored
            </p>
          </div>

          {/* Sample output visual */}
          <div className="panel p-6 sm:p-7">
            <p className="eyebrow">What a result looks like</p>
            <dl className="mt-5 space-y-4">
              {[
                { k: "Lender may offer", v: "₹12,50,000", muted: true },
                { k: "You should carry", v: "₹8,00,000", muted: false },
                { k: "Fair rate", v: "10.5% – 12.5%", muted: false },
                { k: "Safe EMI", v: "₹18,000/month", muted: false },
              ].map((row) => (
                <div
                  key={row.k}
                  className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-3 last:border-0 last:pb-0"
                >
                  <dt className="text-sm text-muted-foreground">{row.k}</dt>
                  <dd
                    className={`num font-display text-2xl ${row.muted ? "text-muted-foreground" : "text-foreground"}`}
                  >
                    {row.v}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 rounded-md bg-surface px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
              Illustrative example. Every number is an estimate based on what you tell us — not an
              offer, and not a prediction of approval.
            </p>
          </div>
        </div>
      </section>

      {/* Core distinction */}
      <section className="mx-auto mt-14 max-w-6xl px-5">
        <div className="rounded-xl border border-border bg-surface-strong px-6 py-8 text-background sm:px-10 sm:py-10">
          <p className="font-display text-2xl leading-snug sm:text-3xl">
            What a lender may give you is not the same as what you should take.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed opacity-80">
            Lenders answer "how much can we recover?". This tool answers "how much can you carry through
            a bad month?" — and shows both numbers side by side so you can negotiate with the safer one.
          </p>
        </div>
      </section>

      {/* What you'll get */}
      <section id="how-it-works" className="mx-auto mt-20 max-w-6xl px-5 scroll-mt-24">
        <p className="eyebrow">What you'll get</p>
        <h2 className="mt-3 text-3xl sm:text-4xl">Six answers, each traceable to your own inputs</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outputs.map((o) => (
            <div key={o.title} className="panel p-5 transition-shadow hover:shadow-lift">
              <o.icon className="size-5 text-primary" />
              <h3 className="mt-4 text-lg leading-snug">{o.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{o.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Samples */}
      <section id="samples" className="mx-auto mt-20 max-w-6xl px-5 scroll-mt-24">
        <p className="eyebrow">Try a sample profile</p>
        <h2 className="mt-3 text-3xl sm:text-4xl">Three real-world borrowers</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Load a profile to see the full flow and result instantly. You can edit any answer afterwards.
        </p>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {sampleBorrowers.map((s) => (
            <div key={s.id} className="panel flex flex-col p-5">
              <h3 className="text-xl">{s.name}</h3>
              <p className="mt-2 text-sm font-medium text-foreground">{s.blurb}</p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
              <button
                type="button"
                onClick={() => loadSample(s.id)}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-positive-soft"
              >
                See {s.name.split(",")[0]}'s result <ArrowRight className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Limitations */}
      <section className="mx-auto mt-20 max-w-6xl px-5">
        <div className="panel p-6 sm:p-8">
          <h2 className="text-2xl">What this tool does not know</h2>
          <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {[
              "Bank underwriting policies",
              "Your credit bureau data",
              "Exact lender pricing",
              "Lender-specific fees, unless you enter them",
              "Your future income",
              "Your exact household cash flow",
              "Lender-specific eligibility criteria",
            ].map((i) => (
              <li key={i} className="flex gap-2">
                <span className="text-border">—</span>
                {i}
              </li>
            ))}
          </ul>
          <p className="mt-5 font-medium">Your actual offer may differ.</p>
        </div>
      </section>
    </Page>
  );
}
