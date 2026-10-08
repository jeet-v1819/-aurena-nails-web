/**
 * Small, dependency-free field components for the admin forms.
 *
 * They are plain presentational components (no hooks) so they can be used from
 * server pages *and* inside client forms without duplicating markup.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="label">
        {label} {required ? <span className="text-rosegold">*</span> : null}
      </label>
      <div className="mt-2">{children}</div>
      {hint && !error ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  name,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  name?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-3">
      <input
        type="checkbox"
        name={name}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-rosegold)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function Fieldset({ legend, children, className }: { legend: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="font-display text-lg">{legend}</legend>
      <div className="mt-4 grid gap-5">{children}</div>
    </fieldset>
  );
}

/** Two/three-column responsive grid used to lay out fields. */
export function FieldGrid({ columns = 2, children }: { columns?: 2 | 3; children: ReactNode }) {
  return (
    <div className={cn("grid gap-5", columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>{children}</div>
  );
}
