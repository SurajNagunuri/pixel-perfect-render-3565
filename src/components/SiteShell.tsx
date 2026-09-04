import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Compass } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Compass className="size-4" />
          </span>
          <span className="font-display text-xl leading-none">Borrower Copilot</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <Link to="/" hash="how-it-works" className="transition-colors hover:text-foreground">
            How it works
          </Link>
          <Link to="/" hash="samples" className="transition-colors hover:text-foreground">
            Sample profiles
          </Link>
          <Link to="/rules" className="transition-colors hover:text-foreground">
            Rules &amp; assumptions
          </Link>
        </nav>
        <Link
          to="/assess"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Check my position
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print mt-24 border-t border-border/70 bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-10 text-sm text-muted-foreground">
        <p className="font-display text-lg text-foreground">Borrower Copilot</p>
        <p className="mt-2 max-w-2xl">
          Educational self-assessment, not a loan approval or financial guarantee. Every number is an
          estimate based on what you tell us. No personal data is stored — your answers stay in this
          browser tab.
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

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function Why({ children, question }: { question: string; children: ReactNode }) {
  return (
    <details className="group mt-4 rounded-lg border border-border/80 bg-surface/70 px-4 py-3">
      <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:hidden">
        <span className="text-primary">Why?</span> {question}
      </summary>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </details>
  );
}

export function ConfidencePill({ level, label }: { level: "High" | "Medium" | "Low"; label?: string }) {
  const tone =
    level === "High"
      ? "bg-positive-soft text-positive"
      : level === "Medium"
        ? "bg-caution-soft text-caution"
        : "bg-danger-soft text-danger";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      {label ?? "Confidence"}: {level}
    </span>
  );
}
