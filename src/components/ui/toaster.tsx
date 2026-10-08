"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

/** App-wide toast host, themed to match the Aurena palette. */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      closeButton
      richColors
      toastOptions={{
        style: {
          borderRadius: "1rem",
          border: "1px solid #e9ded7",
          background: "#fffdfb",
          color: "#2b2427",
          fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif",
        },
      }}
    />
  );
}

type ActionResultLike =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Single place that turns a server-action result into the matching toast, so
 * every screen reports success and failure the same way.
 */
export function notifyResult(result: ActionResultLike, options?: { onSuccess?: () => void }) {
  if (result.ok) {
    toast.success(result.message);
    options?.onSuccess?.();
    return true;
  }

  toast.error(result.error ?? "Something went wrong. Please try again.");
  return false;
}

export async function runWithToast<T extends ActionResultLike>(
  action: () => Promise<T>,
  options?: { loading?: string; onSuccess?: (result: T) => void }
): Promise<T | null> {
  const toastId = options?.loading ? toast.loading(options.loading) : undefined;
  try {
    const result = await action();
    if (toastId) toast.dismiss(toastId);
    notifyResult(result);
    if (result.ok) options?.onSuccess?.(result);
    return result;
  } catch {
    if (toastId) toast.dismiss(toastId);
    toast.error("Something went wrong. Please try again.");
    return null;
  }
}

export { toast };
