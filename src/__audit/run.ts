import { runAssessment } from "../calculations/engine";
import { sampleBorrowers } from "../data/sampleBorrowers";
for (const s of sampleBorrowers as any[]) {
  const r = runAssessment(s.answers);
  console.log(s.name ?? s.label, r.verdict.value, "| rate", r.fairRate.value, "| months", r.assumedTenureMonths, "| safeEMI", r.safeEmi.value, "| reqEMI", r.requestedEmi, "| safeAmt", r.safeAmount.value, "| lender", r.lenderAmount.value, "| apr", r.apr.value, "| fee", r.upfrontFee, "| net", r.netDisbursed, "| tenureNote", r.tenureNote);
  console.log("  notes:", r.confidence.notes.length, r.confidence);
}
