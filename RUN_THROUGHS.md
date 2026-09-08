# Run-throughs — the three borrowers

Figures below are produced by the current code from the sample answers in
`src/data/sampleBorrowers.ts`. Where the brief did not state a fact (household expenses, savings,
insurance, spouse contribution share) the sample carries a clearly-labelled demo assumption; the
brief's own facts are never altered. Load any of them from the home page ("See Priya / Ravi / Anita").

---

## 1. Priya — salaried, strong record

**Brief facts.** 29, Bengaluru, software engineer at a large MNC, 5 years there, ₹1,10,000/month
take-home, car EMI ₹14,000 with 2 years left, credit score 780, rent ₹28,000, wants ₹8,00,000 for a
wedding.

| Output                         | Value                                                              |
| ------------------------------ | ------------------------------------------------------------------ |
| Verdict                        | **BORROW**                                                         |
| Assessed income                | ₹1,10,000/month (stable salary, fully counted)                     |
| Reliable household income      | ₹1,37,500 (includes a demo spouse contribution of ₹27,500)         |
| Free cash flow                 | ₹49,000/month                                                      |
| Safe EMI ceiling               | ₹29,400 (cash flow binds; lending rules alone would allow ₹30,000) |
| Safer amount                   | ₹10,50,000 – ₹11,50,000                                            |
| Lender may sanction            | ₹14,50,000 – ₹16,00,000                                            |
| Fair rate                      | 10.0% – 15.5%                                                      |
| Estimated APR                  | 11.5% – 17.7%                                                      |
| Requested EMI (₹8L, 48 months) | ₹21,363                                                            |
| Rate stress (+2pp)             | ₹22,163/month, burden 33%, ₹7,012 still free                       |
| Confidence                     | High / High / High                                                 |

**Reading.** Her request sits comfortably inside both ceilings, so the verdict is BORROW — but the
gap between what a lender may sanction (₹16 lakh) and what her household should carry (₹11.5 lakh)
is the whole point of the tool. The recommended term is 36 months, not 48: the shortest term whose
EMI still fits is the cheapest loan she can carry.

---

## 2. Ravi — self-employed, undocumented cash income, property to pledge

**Brief facts.** 42, Mysuru, kirana store owner for 14 years, cash income ₹40,000–₹80,000/month, ITR
shows ₹4.2 lakh/year, owns an unencumbered shop/property worth ₹45 lakh, no formal loan history or
credit score, wife earns ₹18,000 teaching, wants ₹15 lakh for a stock line plus a delivery vehicle.

| Output                           | Value                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Verdict                          | **BORROW LESS**                                                                                    |
| Documented income                | ₹35,000/month (ITR ÷ 12 — the peak ₹80,000 month is never assessed)                                |
| Assessed income                  | ₹35,000/month                                                                                      |
| Reliable household income        | ₹58,700 (wife's ₹18,000 counted at ₹2,700 as an occasional teaching income under the demo answers) |
| Free cash flow                   | ₹10,700/month                                                                                      |
| Safe EMI ceiling                 | ₹4,925 (cash flow binds: rules would allow ₹12,250)                                                |
| Safer amount                     | ₹3,90,000 – ₹5,00,000                                                                              |
| Lender may sanction              | ₹12,50,000 – ₹16,00,000 (capped at 60% of the ₹45 lakh property)                                   |
| Product                          | Loan against property (property routes to a secured product)                                       |
| Fair rate                        | 8.5% – 13.0%                                                                                       |
| Estimated APR                    | 9.2% – 14.2%                                                                                       |
| Requested EMI (₹15L, 180 months) | ₹16,814                                                                                            |
| Rate stress (+2pp)               | ₹18,733/month — cash flow goes to **−₹14,919**                                                     |
| Confidence                       | Medium overall, Low on rate (no credit score, undocumented income)                                 |

**Reading.** This is the sharpest illustration of the product principle: his property means a lender
could plausibly sanction the full ₹15 lakh, while his documented, assessable cash flow supports
around ₹5 lakh. Collateral lowered his rate and lengthened his term; it did not raise his safe EMI by
a rupee. No offered term brings a ₹15 lakh EMI under his ceiling, so the tool tells him to reduce the
amount instead of stretching the tenure.

---

## 3. Anita — informal income, fragile household, expensive app loans

**Brief facts.** 35, Hubballi, gig delivery work plus tailoring, ₹26,000–₹30,000/month, two children,
husband unemployed 8 months, three app loans with ₹35,000 outstanding above 30% a year, one EMI
bounced last month, wants ₹1,50,000 for a scooter.

| Output                           | Value                                                  |
| -------------------------------- | ------------------------------------------------------ |
| Verdict                          | **DON'T BORROW**                                       |
| Assessed income                  | ₹23,460/month (informal factor, weak month blended in) |
| Reliable household income        | ₹27,600 (husband contributes nothing)                  |
| Existing app-loan repayments     | ₹6,500 — counted **once**                              |
| Free cash flow                   | **−₹3,100/month**                                      |
| Safe EMI ceiling                 | ₹0                                                     |
| Safer amount                     | ₹0                                                     |
| Lender may sanction              | ₹85,000 – ₹1,10,000 (what she'd likely be _offered_)   |
| Fair rate                        | 13.0% – 27.3%                                          |
| Estimated APR                    | 14.9% – 32.3%                                          |
| Requested EMI (₹1.5L, 48 months) | ₹4,577                                                 |
| Income stress (−15%)             | burden 56%, cash flow −₹11,817                         |
| Confidence                       | Medium overall, Low on rate                            |

**Reading.** She would still be offered around ₹1 lakh. The verdict comes from general rules —
household already running at a deficit, a missed payment inside three months, and 30%+ app-loan debt
— and not from anything specific to her profile. Her ₹6,500 app-loan repayment is reported both as
her existing EMI and as her app-loan payment; because she confirms it is inside the EMI figure, the
model deducts it once. Counting it twice would have shown a ₹9,600 deficit and the wrong reasons. The
tool's answer is what to fix first: clear the 30% app loans, rebuild one month of savings, and revisit.

---

## Regression checks behind these numbers

`bun run test` covers: EMI/reverse-EMI symmetry, the single high-cost-debt definition, the
no-double-counting guard (worth exactly ₹6,000 of free cash flow in the fixture), spouse income never
counted in full, collateral routing by asset type and never raising the safe EMI, safe EMI never
exceeding either capacity, lender ceilings never below safe ceilings, unknowns never treated as zero,
APR always above the headline rate, missed payments materially reducing capacity, and one scenario
block per borrower above.
