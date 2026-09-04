import type { ReactNode } from "react";
import { AlertCircle, Check } from "lucide-react";
import { groupINR, inrWords, parseINRInput } from "@/lib/inr";

export function QuestionShell({
  label,
  hint,
  children,
  error,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  error?: string | null;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[1.6rem] leading-[1.2] tracking-tight sm:text-[2.1rem]">{label}</h1>
        {hint ? <p className="mt-2.5 text-[0.925rem] leading-relaxed text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 text-sm font-medium text-danger">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  columns = 1,
}: {
  options: { value: T; label: string; sub?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: 1 | 2 | 3 | 4;
}) {
  const cols =
    columns === 4
      ? "grid-cols-2 sm:grid-cols-4"
      : columns === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : columns === 2
          ? "sm:grid-cols-2"
          : "";
  return (
    <div className={`grid gap-2.5 ${cols}`} role="radiogroup">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-all active:scale-[0.995] ${
              active
                ? "border-primary bg-primary/15 shadow-card"
                : "border-border bg-card hover:border-primary/45 hover:bg-surface/60"
            }`}
          >
            <span className="min-w-0">
              <span className="block text-[0.95rem] font-medium leading-snug">{o.label}</span>
              {o.sub ? <span className="mt-0.5 block text-xs text-muted-foreground">{o.sub}</span> : null}
            </span>
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full border ${
                active ? "border-primary bg-primary text-primary-foreground" : "border-input"
              }`}
            >
              {active ? <Check className="size-3" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function MoneyInput({
  value,
  onChange,
  placeholder,
  suffix,
  autoFocus,
  quickAdd,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  suffix?: string;
  autoFocus?: boolean;
  /** Tap-to-fill amounts, so a phone keyboard is optional. */
  quickAdd?: number[];
}) {
  const words = inrWords(value);
  return (
    <div className="space-y-2.5">
      <div className="flex items-center rounded-xl border border-input bg-card px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
        <span className="mr-2 font-display text-2xl text-muted-foreground">₹</span>
        <input
          inputMode="numeric"
          autoFocus={autoFocus}
          value={groupINR(value)}
          placeholder={placeholder}
          onChange={(e) => onChange(parseINRInput(e.target.value))}
          className="num w-full min-w-0 bg-transparent py-4 text-2xl outline-none placeholder:text-lg placeholder:text-muted-foreground/70"
        />
        {suffix ? <span className="ml-2 shrink-0 text-sm text-muted-foreground">{suffix}</span> : null}
      </div>
      <div className="flex min-h-6 flex-wrap items-center gap-2">
        {words ? (
          <span className="text-sm text-muted-foreground">
            {words}
            {suffix ?? ""}
          </span>
        ) : quickAdd?.length ? (
          quickAdd.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onChange(q)}
              className="rounded-full border border-input bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {inrWords(q)}
            </button>
          ))
        ) : null}
      </div>
    </div>
  );
}

export function PlainInput({
  value,
  onChange,
  placeholder,
  suffix,
  step,
  autoFocus,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  suffix?: string;
  step?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex items-center rounded-xl border border-input bg-card px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
      <input
        type="number"
        step={step}
        autoFocus={autoFocus}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="num w-full min-w-0 bg-transparent py-4 text-2xl outline-none placeholder:text-lg placeholder:text-muted-foreground/70"
      />
      {suffix ? <span className="ml-2 shrink-0 text-sm text-muted-foreground">{suffix}</span> : null}
    </div>
  );
}

/** "I don't know" is a first-class answer here — never a dead end. */
export function SkipButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex rounded-full border border-dashed border-input px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
    >
      {children}
    </button>
  );
}
