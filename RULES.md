# Rules and assumptions

Every number in Borrower Copilot comes from this file's values, which live in code at
`src/rules/rules.ts` and are applied in `src/calculations/engine.ts`. Nothing is hardcoded per
borrower. Each item below is tagged:

- **market estimate** — an indicative figure drawn from how Indian retail lending is commonly priced.
- **lending convention** — how lenders commonly assess, expressed as a prototype approximation.
- **my judgement** — a borrower-safety choice this tool makes deliberately, which a lender would not make.

This is an educational self-assessment tool. It is not lender policy, not regulation, and not an
approval.

## 1. Two capacities, never mixed

| Output                | Question it answers             | Basis                                                   |
| --------------------- | ------------------------------- | ------------------------------------------------------- |
| Lender-side ceiling   | "What might they offer me?"     | Higher FOIR, collateral LTV — _lending convention_      |
| Borrower-safe ceiling | "What should I actually carry?" | Lower FOIR **and** household cash flow — _my judgement_ |

`safeEmi = MIN(safe FOIR capacity, household cash-flow capacity)`, then reduced by the documented
haircuts in section 5. Both capacities are always shown, never merged.

## 2. Income actually assessed — _lending convention_

| Situation                    | Assessed                                           |
| ---------------------------- | -------------------------------------------------- |
| Salaried, variable pay ≤ 25% | 100% of take-home                                  |
| Salaried, variable pay > 25% | 85%                                                |
| Informal / gig / cash        | 85% of typical month                               |
| Self-employed with ITR       | documented income only (ITR ÷ 12), never peak cash |
| Self-employed without ITR    | 60% of stated cash income                          |

Variable earners are also asked what a weaker but normal month brings in. When given, the assessed
figure is a blend weighted 60% to the weak month — _my judgement_, because the EMI must survive that
month too.

## 3. Debt-service ratios (FOIR) — _lending convention_ / _my judgement_

| Income type   | Safe (this tool) | Lender-style |
| ------------- | ---------------- | ------------ |
| Salaried      | 40%              | 50%          |
| Self-employed | 35%              | 45%          |
| Mixed         | 35%              | 45%          |
| Informal      | 30%              | 40%          |

Existing EMIs are subtracted from both. An unknown existing-EMI figure is treated as unknown: it is
not subtracted, and the result says every number is therefore an over-estimate.

## 4. Household cash flow — _my judgement_

```text
reliable household income
  = assessed/plannable borrower income + reliable spouse contribution
free cash flow
  = reliable income − household expenses − existing EMIs − insurance
    − card/app-loan payment (only if not already inside existing EMIs)
    − other fixed commitments − allowance for skipped expense categories
cash-flow EMI cap = 60% of free cash flow
```

The 40% left untouched is for irregular costs, festivals, repairs and medical bills.

The allowance for skipped expense categories is shown as its own line in the cash-flow
breakdown, so the figures on screen always add up to the "left over each month" number.

Spouse income is never counted in full. Contribution = income × regularity (regular 1.0, sometimes
0.6, no/prefer-not 0) × the share that reaches the household (most 0.75, half 0.5, smaller 0.25,
unsure 0.25). If the borrower states the actual rupee contribution, that figure is used instead.

Insurance is a recurring commitment, never debt: it reduces cash flow and never enters FOIR or the
rate.

Children and other dependents are _never_ a separate deduction. Their costs belong inside the
expense categories (education, food, medical, transport), so nothing is counted twice. Marital
status only decides whether spouse questions are asked; it never implies dependents.

## 5. Safety haircuts applied to the safe EMI — _my judgement_

| Signal                                        | Reduction         |
| --------------------------------------------- | ----------------- |
| Over 25% of pay variable                      | 15%               |
| Income varies a little / a lot                | 5% / 15%          |
| Missed payment in last 3 months               | 25%               |
| Missed payment earlier in the year            | 10%               |
| Each extra miss in 12 months                  | 5%, capped at 15% |
| Under 1 month / 1–3 months savings            | 10% / 5%          |
| Debt priced at 24%+                           | 15%               |
| Revolving balance above one month of income   | 10%               |
| 3+ loans running at once                      | 10%               |
| Outstanding balances above 6 months of income | 10%               |
| Expenses above 60% of reliable income         | 15%               |

## 6. One definition of expensive debt — _my judgement_

Debt is expensive at **24% a year or more**. The signal is true if _any_ of these hold: the rate on
existing loans, the rate on a card or app loan, or the borrower's own explicit answer. A later
"I don't know" can never erase a signal an earlier answer established.

## 7. Rate bands — _market estimate_

Indicative annual bands: home 7.5–9.5, loan against property 9–12.5, gold 9–15, personal 10–18,
vehicle 10–18, business 11–22, other unsecured 12–22. Unsecured borrowing by undocumented earners
with no known score is widened toward 16–30.

Adjustments: score 780+ −1.5, 730–779 −0.75, 680–729 0, 620–679 +1.5, under 620 +3; unknown score
widens the top by 2.5 (unknown is not treated as bad); highly variable income +1.25 at the top;
under a year in job/business +1.5; 5+ years −0.5 at the floor; undocumented income +1.5 at the top;
recent missed payment +3; older miss +1; expensive existing debt +1.5 at the top; 3+ live loans +1
at the top; pledged collateral −2. Every band is floored by product and kept at least 1.5 points
wide — a single number would be false precision.

Nothing about marital status, dependents, children, gender or insurance affects the rate.

## 8. Collateral — _lending convention_

Collateral changes the **product**, not affordability. Property routes to a loan against property;
gold routes to a gold loan; "something else" or "not sure" stays on unsecured pricing, with a note
to ask a lender directly. A lender sanction is capped at 60% of value, reduced to 50% of that when
the asset already carries a loan and 75% of it when the borrower is unsure. Collateral can never
raise the safe EMI.

Because a secured sanction is capped by the asset's free value, the safer borrowing figure is also
capped there: what you should carry can never sit above what could actually be advanced against
that asset. Collateral still never raises the safe EMI.

## 9. APR and charges — _market estimate_

With no quote we assume a 1.5% processing fee plus 0.2% other upfront charges. Those come off the
disbursal, so APR is solved from the net amount actually received and the EMI schedule. APR is
therefore always higher than the headline rate — the reason the card tells borrowers never to
compare offers on the rate alone.

## 10. Stress testing — _my judgement_

Unstable earners are stressed on income: a 15% drop. Everyone else is stressed on rate: +2
percentage points. Both are also shown as free cash flow after the new EMI under stress, so the
borrower sees the shortfall in rupees.

## 11. Tenure — _lending convention_

Product defaults: home 240, LAP 180, vehicle/personal/business/other 48, gold 24 months. Tenure is
cut so a salaried borrower repays by 60 and others by 70, minimum 12 months. The recommended tenure
is the shortest offered term whose EMI still fits the safe ceiling; when none does, the tool says to
reduce the amount rather than stretch the term.

## 12. Verdicts

- **DON'T BORROW** — no room left after commitments, or a recent missed payment together with
  expensive debt, or an EMI larger than all free cash combined with any fragility signal. It is
  reached from these general rules only; there is no per-borrower override anywhere in the code.
- **BORROW LESS** — capacity exists, but the requested amount or its EMI sits above the safer range.
- **BORROW** — the request fits inside the safer range and under the ceiling.

## 13. Unknowns

Unknown is never zero and never a penalty in disguise. Skipped expense categories draw a 3%-of-income
allowance, unknown insurance a 2% allowance, and both are named on screen. Unknown score, savings or
payment history widen the range and lower confidence instead of assuming the worst.

## 14. Input hygiene — _my judgement_

Every calculation runs on sanitised answers. A negative, non-numeric or impossible figure (a
negative income, an out-of-range age) is treated as _not answered_ rather than flowing through the
maths, so no output can ever be negative or nonsensical. A blank amount means no charges and no
disbursal to show — the APR then simply equals the fair-rate band.
