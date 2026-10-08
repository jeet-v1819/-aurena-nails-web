"use client";

/**
 * Client-side interactive primitives: modal dialogs, submit buttons with
 * pending state, and a confirmation dialog used before destructive actions.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------- modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * The dialog is rendered in a portal, so it may only appear once React has
   * taken over on the client. `useSyncExternalStore` reports false while
   * server-rendering and true after hydration — no state update in an effect.
   */
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Escape closes, focus moves into the dialog, background scroll is locked.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!hydrated || !open) return null;

  const widths = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  } as const;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-charcoal/40 p-4 backdrop-blur-sm sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "relative z-10 my-8 w-full rounded-3xl border border-line bg-cream shadow-[0_30px_80px_-40px_rgba(43,36,39,0.6)] outline-none",
          widths[size]
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <h2 className="font-display text-xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted transition hover:bg-cream-deep hover:text-charcoal"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>

        {footer ? <footer className="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4">{footer}</footer> : null}
      </div>
    </div>,
    document.body
  );
}

/* ---------------------------------------------------------- submit buttons */

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingLabel,
  disabled,
  title,
}: {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
  disabled?: boolean;
  title?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={cn(className, "disabled:opacity-60")} disabled={pending || disabled} title={title}>
      {pending ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          {pendingLabel ?? "Please wait…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Simple busy button for handlers that are not <form> submissions. */
export function ActionButton({
  children,
  onClick,
  busy,
  className = "btn-primary",
  pendingLabel,
  disabled,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void | Promise<void>;
  busy?: boolean;
  className?: string;
  pendingLabel?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [internalBusy, setInternalBusy] = useState(false);
  const isBusy = busy ?? internalBusy;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(className, "disabled:opacity-60")}
      disabled={isBusy || disabled}
      onClick={async () => {
        setInternalBusy(true);
        try {
          await onClick();
        } finally {
          setInternalBusy(false);
        }
      }}
    >
      {isBusy ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          {pendingLabel ?? "Please wait…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/* ------------------------------------------------------- confirm dialog */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Yes, continue",
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
  tone = "danger",
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  tone?: "danger" | "primary";
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn-danger" : "btn-primary"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-charcoal-soft">{message}</p>
    </Modal>
  );
}
