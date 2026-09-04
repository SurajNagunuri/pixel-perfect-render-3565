export function formatINR(value: number | null | undefined, opts?: { compact?: boolean }): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const v = Math.round(value);
  if (opts?.compact) {
    if (Math.abs(v) >= 10000000) return `₹${trim(v / 10000000)}Cr`;
    if (Math.abs(v) >= 100000) return `₹${trim(v / 100000)}L`;
    if (Math.abs(v) >= 1000) return `₹${trim(v / 1000)}K`;
  }
  return `₹${v.toLocaleString("en-IN")}`;
}

function trim(n: number): string {
  return n.toFixed(n < 10 ? 2 : 1).replace(/\.?0+$/, "");
}

export function formatINRBand(low: number, high: number, compact = true): string {
  return `${formatINR(low, { compact })}–${formatINR(high, { compact })}`;
}

export function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export function parseINRInput(raw: string): number | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits === "") return null;
  return Number(digits);
}

export function groupINR(value: number | null): string {
  if (value === null) return "";
  return value.toLocaleString("en-IN");
}
