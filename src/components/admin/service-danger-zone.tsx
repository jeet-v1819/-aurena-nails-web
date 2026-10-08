"use client";

/**
 * Deleting a service is a destructive act, so it lives in its own clearly
 * labelled zone with a confirmation that repeats the consequences.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { deleteServiceAction } from "@/server/actions/admin/catalog";
import { ConfirmDialog } from "@/components/ui/interactive";
import { Alert } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";

export function ServiceDangerZone({
  serviceId,
  serviceName,
  appointmentCount,
  reviewCount,
}: {
  serviceId: string;
  serviceName: string;
  appointmentCount: number;
  reviewCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);

    const result = await deleteServiceAction({ serviceId });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      notifyResult(result);
      return;
    }

    notifyResult(result);
    setOpen(false);
    router.push("/admin/services");
    router.refresh();
  };

  return (
    <section className="card border-danger/30 p-6">
      <h2 className="flex items-center gap-2 font-display text-xl text-danger">
        <AlertTriangle size={18} /> Delete this service
      </h2>

      <p className="mt-2 text-sm text-muted">
        This cannot be undone. The service, its photos and its videos are permanently removed
        {appointmentCount > 0 ? ` after the ${appointmentCount} appointment${appointmentCount === 1 ? "" : "s"} that reference it` : ""}
        {reviewCount > 0 ? ` and its ${reviewCount} review${reviewCount === 1 ? "" : "s"}` : ""}.
      </p>

      {error ? (
        <div className="mt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}

      <button type="button" className="btn-danger mt-5" onClick={() => setOpen(true)} disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        {busy ? "Deleting…" : "Delete service"}
      </button>

      <ConfirmDialog
        open={open}
        title="Are you sure you want to delete this service?"
        message={`“${serviceName}” will be removed from the website together with its photos and videos. Past appointments keep their history. This cannot be undone.`}
        confirmLabel="Yes, delete service"
        cancelLabel="Keep service"
        onConfirm={remove}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}
