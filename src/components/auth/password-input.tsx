"use client";

/** Password field with a show/hide toggle (accessible, keeps the value intact). */
import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function PasswordInput({
  id,
  className,
  ...props
}: { id: string } & Omit<ComponentProps<"input">, "id" | "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        className={cn("input pr-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted transition hover:text-charcoal"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/** Small strength hint shown under new-password fields. */
export function PasswordHints({ value }: { value: string }) {
  const checks = [
    { label: "8+ characters", ok: value.length >= 8 },
    { label: "lowercase", ok: /[a-z]/.test(value) },
    { label: "uppercase", ok: /[A-Z]/.test(value) },
    { label: "number", ok: /\d/.test(value) },
  ];

  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem]">
      {checks.map((check) => (
        <li key={check.label} className={check.ok ? "text-success" : "text-muted"}>
          {check.ok ? "✓" : "•"} {check.label}
        </li>
      ))}
    </ul>
  );
}
