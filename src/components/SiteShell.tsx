import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ChevronDown, Compass } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto grid h-15 max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Compass className="size-4" />
          </span>
          <span className="truncate font-display text-lg leading-none sm:text-xl">
            Borrower Copilot
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted-foreground">
          <Link to="/rules" className="hidden transition-colors hover:text-foreground sm:block">
            How we calculate
          </Link>
          <ThemeToggle />
          <Link
            to="/assess"
            className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Check my position
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print mt-20 border-t border-border/70 bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-9 text-sm text-muted-foreground">
        <p className="font-display text-lg text-foreground">Borrower Copilot</p>
        <p className="mt-2 max-w-2xl leading-relaxed">
          Educational self-assessment, not a loan approval or financial guarantee. Every number is
          an estimate based on what you tell us, and your answers stay in this browser tab.
        </p>
        <p className="mt-4">
          <Link to="/rules" className="underline underline-offset-4 hover:text-foreground">
            How we calculate this
          </Link>
        </p>
      </div>
    </footer>
  );
}

export function Page({ children, bare }: { children: ReactNode; bare?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      {bare ? null : <SiteFooter />}
    </div>
  );
}

/** Every number on the results page can be opened up to show its reasoning. */
export function Why({ children, question }: { question: string; children: ReactNode }) {
  return (
    <details className="group mt-4 rounded-xl border border-border/80 bg-surface/70">
      <summary className="flex cursor-pointer list-none items-start gap-2.5 px-4 py-3.5 text-sm font-medium marker:hidden">
        <ChevronDown className="mt-0.5 size-4 shrink-0 text-primary transition-transform group-open:rotate-180" />
        <span className="min-w-0">
          <span className="text-primary">Why this number? </span>
          <span className="text-muted-foreground">{question}</span>
        </span>
      </summary>
      <div className="px-4 pb-4 pl-11 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

const CONFIDENCE_MEANING: Record<string, string> = {
  High: "You answered everything that materially moves this number.",
  Medium: "Some inputs are missing or hard to verify, so treat this as indicative.",
  Low: "Key information is unknown, so this is a wide estimate — not a firm figure.",
};

export function ConfidencePill({
  level,
  label,
}: {
  level: "High" | "Medium" | "Low";
  label?: string;
}) {
  const tone =
    level === "High"
      ? "bg-positive-soft text-positive"
      : level === "Medium"
        ? "bg-caution-soft text-caution"
        : "bg-danger-soft text-danger";
  const filled = level === "High" ? 3 : level === "Medium" ? 2 : 1;
  return (
    <span
      title={CONFIDENCE_MEANING[level]}
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      <span className="flex items-center gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`block size-1.5 rounded-full ${i < filled ? "bg-current" : "bg-current/25"}`}
          />
        ))}
      </span>
      {label ? `${label}: ${level}` : level}
    </span>
  );
}

/** Section heading used to give the results page a single obvious reading order. */
export function ResultSection({
  step,
  title,
  question,
  children,
}: {
  step: number;
  title: string;
  question?: string;
  children: ReactNode;
}) {
  return (
    <section className="scroll-mt-20">
      <div className="flex items-baseline gap-3">
        <span className="num text-sm text-muted-foreground/70">
          {String(step).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[1.45rem] leading-tight sm:text-[1.7rem]">{title}</h2>
          {question ? <p className="mt-1 text-sm text-muted-foreground">{question}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Horizontal bar used for amount / EMI comparisons. Numbers alone don't show
 * how far apart "what they'll offer" and "what you should take" really are.
 */
export function CompareBar({
  label,
  caption,
  value,
  max,
  tone = "neutral",
  emphasis,
}: {
  label: string;
  caption: string;
  value: number;
  max: number;
  tone?: "neutral" | "safe" | "caution" | "danger";
  emphasis?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(2, (value / max) * 100)) : 0;
  const fill =
    tone === "safe"
      ? "bg-positive"
      : tone === "caution"
        ? "bg-caution"
        : tone === "danger"
          ? "bg-danger"
          : "bg-muted-foreground/45";
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
        <p
          className={`min-w-0 truncate text-sm ${emphasis ? "font-medium text-foreground" : "text-muted-foreground"}`}
        >
          {label}
        </p>
        <p
          className={`num shrink-0 ${emphasis ? "font-display text-xl" : "text-sm text-muted-foreground"}`}
        >
          {caption}
        </p>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${fill} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
