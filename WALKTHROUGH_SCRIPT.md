# Walkthrough script (about 5 minutes)

A demo script for showing Borrower Copilot. Numbers cited are the ones the app produces today; see
`RUN_THROUGHS.md`.

## 0. The one-line premise (20s)

"Every borrowing tool in India tells you what you can get. This one tells you what you should take —
and shows you the gap between the two."

Open the home page. Point at the two figures in the hero contrast, then the three sample borrowers.

## 1. Priya — the easy case is still not the obvious case (60s)

Load Priya. Go straight to the result.

- "She asked for ₹8 lakh. Verdict: borrow — fine."
- "But look here: a lender could plausibly sanction ₹16 lakh. Her household supports ₹11.5 lakh."
- Tap **Why?** on the safe EMI. "₹29,400. Lending rules alone would have allowed ₹30,000, but her
  actual household spending is what sets the ceiling. Every number on this page opens like this."
- Scroll to the tenure table. "48 months is what she'd be sold. 36 months is what we recommend —
  shortest term that still fits the ceiling, so the least interest she can pay."

## 2. Ravi — the case the industry gets wrong (90s)

Load Ravi. This is the centre of the demo.

- "Kirana store, 14 years, cash income up to ₹80,000 a month, ₹45 lakh shop, no credit score. He wants
  ₹15 lakh."
- "A lender sees the property and can sanction the full ₹15 lakh — we say so, right here."
- "We assess ₹35,000 a month, because that's what his ITR documents. Not the good month."
- "His safe amount is about ₹5 lakh. Same borrower, same day: ₹16 lakh available, ₹5 lakh safe."
- Point at the collateral line. "His property lowered his rate from business-loan pricing to 8.5%
  and stretched the term. It did not raise his safe EMI by one rupee — collateral is not income."
- Stress case. "+2 points on the rate and his household is ₹14,900 short every month. That's the
  loan he was going to be approved for."
- Tenure table: "no term brings ₹15 lakh under his ceiling, so we tell him to borrow less rather than
  stretch to 20 years."

## 3. Anita — saying no, and saying what to do instead (60s)

Load Anita.

- "Gig delivery and tailoring, ₹26–30,000, two kids, husband out of work eight months, three app loans
  at over 30%, one EMI bounced last month. She wants ₹1.5 lakh for a scooter — which would earn her
  more."
- "DON'T BORROW. Her household is already ₹3,100 short every month before any new EMI."
- "She would still be offered about ₹1 lakh. We show that number precisely because someone will offer
  it to her."
- Point at next steps. "This is the part that matters: clear the 30% loans first, rebuild one month of
  savings, then come back. Not a rejection — a sequence."
- Optional, if asked about rigour: "Her app-loan repayment appears twice in her answers, as an EMI and
  as an app-loan payment. We ask whether it's already inside the EMI figure and count it once. Counting
  it twice would have shown a ₹9,600 deficit and the wrong reasons."

## 4. The negotiation card (45s)

Open **/card** from Anita's or Priya's result.

- "One page, printable, designed for the conversation itself: target amount, fair rate band, APR, the
  EMI ceiling never to cross, and five questions to ask any lender."
- Read the closing line aloud: "Never compare loan offers using the headline interest rate alone."
- "That's why APR is on the card. On Priya's numbers the rate is 10% and the APR is 11.5% — fees come
  off the disbursal."

## 5. Rules and honesty (45s)

Open **/rules**.

- "Every assumption is here and tagged: market estimate, lending convention, or my judgement. The
  40% cash-flow buffer is a judgement, and it's labelled as one."
- "Unknown is never zero. Skip an expense and we hold a small allowance and tell you. Don't know your
  score and the range widens instead of assuming the worst."
- "No risk score, no probability of default, no loan-selling. It's a self-assessment, and it says so
  on the card."

## 6. Close (20s)

- "Runs entirely in the browser: no login, no database, no data leaving the device."
- "One number changed in the rules file updates every output, for every borrower, everywhere."
- Optional: toggle light/dark, then resize to a phone width. "Built mobile-first — this is the screen
  the borrower actually has."
