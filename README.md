# Borrower Copilot

A borrowing decision assistant for Indian borrowers, built on one principle:

> **What a lender may give you is not the same as what you should take.**

Most tools calculate an EMI or predict an approval. Borrower Copilot answers the question a borrower
actually has — *should I take this loan, and on what terms* — and shows the gap between lender-side
capacity and household-safe capacity for the same person on the same day.

## What it produces

For every borrower:

1. **A verdict** — BORROW / BORROW LESS / DON'T BORROW, with reasons.
2. **Indicative lender capacity** — what might realistically be sanctioned.
3. **Borrower-safe capacity** — what the household can carry, from the lower of a conservative
   debt-service ratio and actual monthly cash flow.
4. **A fair rate band** for the profile, plus an **estimated APR** including upfront charges.
5. **A safe EMI ceiling**, with the binding constraint named.
6. **A stress case** — a 15% income drop for unstable earners, +2 percentage points on rate otherwise.
7. **A printable negotiation card** with the five questions to ask any lender.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | The premise, the lender-vs-safe contrast, and three sample borrowers |
| `/assess` | Adaptive questionnaire — asks only what the answers so far make relevant |
| `/results` | Full assessment; every figure has a "Why?" explanation |
| `/card` | One-page printable negotiation card (Print / Save as PDF) |
| `/rules` | Every assumption, tagged market estimate / lending convention / my judgement |

## Design commitments

- **Rupees throughout**, in Indian formatting, with lakh/crore phrasing where it reads naturally.
- **Mobile-first.** The borrower's screen is a phone.
- **Every number is explainable.** No figure appears without a plain-language reason.
- **Unknown is never zero.** Skipped answers draw a small, named allowance; unknown credit history
  widens the range and lowers confidence rather than assuming the worst.
- **Ranges, not false precision.** Rate bands are never narrower than 1.5 percentage points.
- **No risk scoring**, no probability-of-default language, no loan selling, no approval prediction.
- **Nothing arbitrary.** Marital status, children, gender and insurance never affect the rate;
  collateral never raises affordability.
- **No backend.** Everything runs in the browser — no login, no database, no external API, no data
  leaving the device.

## Documentation

- [`RULES.md`](RULES.md) — every rule, ratio, haircut and assumption, with its tag.
- [`RUN_THROUGHS.md`](RUN_THROUGHS.md) — the three sample borrowers with the numbers the app produces.
- [`WALKTHROUGH_SCRIPT.md`](WALKTHROUGH_SCRIPT.md) — a five-minute demo script.

## Code map

```text
src/rules/rules.ts          every assumption, in one place — change a number, all outputs update
src/calculations/engine.ts  the model: income, cash flow, FOIR, EMI, rates, APR, stress, verdict
src/types/index.ts          the answer and assessment schema
src/data/sampleBorrowers.ts the three sample profiles
src/routes/                 assess / results / card / rules pages
src/calculations/engine.test.ts  scenario and regression tests
```

## Stack

TanStack Start, React, TypeScript, Tailwind CSS v4, shadcn/ui, Lucide icons, Vitest.

## Running it

```sh
bun install
bun run dev        # http://localhost:8080
bun run test       # scenario and regression tests
bunx tsgo --noEmit # types
bun run build
```

## Scope

An educational self-assessment prototype. Figures are estimates from self-reported information using
prototype affordability rules — not lender policy, not regulation, not a loan approval or financial
guarantee.
