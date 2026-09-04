import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { groupINR, parseINRInput } from "@/lib/inr";

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
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl leading-snug sm:text-3xl">{label}</h2>
        {hint ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
    </div>
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
  columns?: 1 | 2;
}) {
  return (
    <div className={`grid gap-2.5 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3.5 text-left transition-all ${
              active
                ? "border-primary bg-positive-soft/60 shadow-card"
                : "border-border bg-card hover:border-primary/50"
            }`}
          >
            <span>
              <span className="block text-[0.95rem] font-medium">{o.label}</span>
              {o.sub ? <span className="mt-0.5 block text-xs text-muted-foreground">{o.sub}</span> : null}
            </span>
            {active ? <Check className="mt-0.5 size-4 shrink-0 text-primary" /> : null}
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
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center rounded-lg border border-input bg-card px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
      <span className="mr-2 font-display text-2xl text-muted-foreground">₹</span>
      <input
        inputMode="numeric"
        value={groupINR(value)}
        placeholder={placeholder}
        onChange={(e) => onChange(parseINRInput(e.target.value))}
        className="num w-full bg-transparent py-3.5 text-2xl outline-none placeholder:text-base placeholder:text-muted-foreground"
      />
      {suffix ? <span className="ml-2 shrink-0 text-sm text-muted-foreground">{suffix}</span> : null}
    </div>
  );
}

export function PlainInput({
  value,
  onChange,
  placeholder,
  suffix,
  step,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  suffix?: string;
  step?: string;
}) {
  return (
    <div className="flex items-center rounded-lg border border-input bg-card px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
      <input
        type="number"
        step={step}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="num w-full bg-transparent py-3.5 text-2xl outline-none placeholder:text-base placeholder:text-muted-foreground"
      />
      {suffix ? <span className="ml-2 shrink-0 text-sm text-muted-foreground">{suffix}</span> : null}
    </div>
  );
}

export function SkipButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
    >
      {children}
    </button>
  );
}
