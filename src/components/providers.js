"use client";

/**
 * Client-side providers: NextAuth session + a lightweight toast system.
 *
 * The README lists a "Toast notification framework" as a completed feature but
 * no such component existed; pages used `alert()` instead (e.g. the products
 * grid's "Add to cart functionality coming soon"). This is the real thing.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SessionProvider } from "next-auth/react";

const ToastContext = createContext(null);

let toastSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, { variant = "info", title, duration = 4000 } = {}) => {
      if (!message) return null;
      toastSeq += 1;
      const id = toastSeq;
      setToasts((current) => [...current.slice(-3), { id, message: String(message), variant, title }]);

      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  // Clear pending timers on unmount so nothing fires against a dead component.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      toast: push,
      success: (message, options) => push(message, { ...options, variant: "success" }),
      error: (message, options) => push(message, { ...options, variant: "error" }),
      info: (message, options) => push(message, { ...options, variant: "info" }),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const VARIANT_STYLES = {
  success: "border-green-200 bg-green-50 text-green-900",
  error: "border-red-200 bg-red-50 text-red-900",
  info: "border-gray-200 bg-white text-gray-900",
};

const VARIANT_ICON = {
  success: "M5 13l4 4L19 7",
  error: "M6 6l12 12M18 6 6 18",
  info: "M12 8h.01M11 12h1v4h1",
};

function ToastViewport({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${
            VARIANT_STYLES[toast.variant] || VARIANT_STYLES.info
          }`}
        >
          <svg className="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d={VARIANT_ICON[toast.variant] || VARIANT_ICON.info} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="min-w-0 flex-1">
            {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
            <p className="text-sm break-words">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
            className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

/** Access the toast API from any client component. */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fail soft rather than crash a page that forgot the provider.
    return {
      toast: () => null,
      success: () => null,
      error: () => null,
      info: () => null,
      dismiss: () => null,
    };
  }
  return context;
}

export default function Providers({ children, session }) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
