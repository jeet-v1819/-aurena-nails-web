"use client";

/**
 * Admin controls for a single customer: edit their details, activate or
 * deactivate their account, and soft-delete it (with the confirmation wording
 * the studio asked for).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Power, Trash2 } from "lucide-react";
import {
  deleteCustomerAction,
  setCustomerActiveAction,
  updateCustomerAction,
} from "@/server/actions/admin/people";
import { ConfirmDialog, Modal } from "@/components/ui/interactive";
import { Alert } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";

export function CustomerRowActions({
  customer,
}: {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    isActive: boolean;
  };
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeOpen, setActiveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [form, setForm] = useState({
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    mobile: customer.mobile,
    isActive: customer.isActive,
  });

  const save = async () => {
    setBusy(true);
    setError(null);
    setFieldErrors({});

    const result = await updateCustomerAction({ customerId: customer.id, ...form });
    setBusy(false);

    if (!result.ok) {
      notifyResult(result);
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notifyResult(result);
    setEditOpen(false);
    router.refresh();
  };

  const toggleActive = async () => {
    setBusy(true);
    const result = await setCustomerActiveAction({ customerId: customer.id, isActive: !customer.isActive });
    setBusy(false);
    notifyResult(result);
    setActiveOpen(false);
    if (result.ok) router.refresh();
  };

  const remove = async () => {
    setBusy(true);
    const result = await deleteCustomerAction({ customerId: customer.id });
    setBusy(false);
    notifyResult(result);
    setDeleteOpen(false);
    if (result.ok) router.refresh();
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        className="rounded-full p-2 text-muted transition hover:bg-cream-deep hover:text-charcoal"
        aria-label={`Edit ${customer.firstName} ${customer.lastName}`}
        onClick={() => {
          setForm({
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            mobile: customer.mobile,
            isActive: customer.isActive,
          });
          setError(null);
          setFieldErrors({});
          setEditOpen(true);
        }}
      >
        <Pencil size={15} />
      </button>

      <button
        type="button"
        className={
          customer.isActive
            ? "rounded-full p-2 text-muted transition hover:bg-cream-deep hover:text-warning"
            : "rounded-full p-2 text-muted transition hover:bg-cream-deep hover:text-success"
        }
        aria-label={customer.isActive ? "Deactivate customer" : "Activate customer"}
        onClick={() => setActiveOpen(true)}
      >
        <Power size={15} />
      </button>

      <button
        type="button"
        className="rounded-full p-2 text-muted transition hover:bg-cream-deep hover:text-danger"
        aria-label={`Delete ${customer.firstName} ${customer.lastName}`}
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 size={15} />
      </button>

      {/* ------------------------------------------------------------ edit */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit customer"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setEditOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : null} Save changes
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="min-w-0">
              <span className="label">First name</span>
              <input
                className="input mt-2"
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
              />
              {fieldErrors.firstName ? <p className="field-error">{fieldErrors.firstName[0]}</p> : null}
            </label>
            <label className="min-w-0">
              <span className="label">Last name</span>
              <input
                className="input mt-2"
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
              />
              {fieldErrors.lastName ? <p className="field-error">{fieldErrors.lastName[0]}</p> : null}
            </label>
          </div>

          <label className="block">
            <span className="label">Email address</span>
            <input
              type="email"
              className="input mt-2"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            {fieldErrors.email ? <p className="field-error">{fieldErrors.email[0]}</p> : null}
          </label>

          <label className="block">
            <span className="label">Mobile number</span>
            <input
              className="input mt-2"
              value={form.mobile}
              onChange={(event) => setForm({ ...form, mobile: event.target.value })}
            />
            {fieldErrors.mobile ? <p className="field-error">{fieldErrors.mobile[0]}</p> : null}
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-rosegold)]"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            Account active
            <span className="text-xs text-muted">(inactive customers cannot sign in)</span>
          </label>

          <p className="text-xs text-muted">
            Passwords are never shown or set here — customers manage their own password from their profile or the reset
            flow.
          </p>
        </div>
      </Modal>

      {/* --------------------------------------------------- activate/deactivate */}
      <ConfirmDialog
        open={activeOpen}
        title={customer.isActive ? "Deactivate this customer?" : "Activate this customer?"}
        message={
          customer.isActive
            ? `${customer.firstName} will no longer be able to sign in — their bookings and history stay safe. You can reactivate the account at any time.`
            : `${customer.firstName} will be able to sign in and book appointments again.`
        }
        confirmLabel={customer.isActive ? "Yes, deactivate" : "Yes, activate"}
        cancelLabel="Cancel"
        tone={customer.isActive ? "danger" : "primary"}
        onConfirm={toggleActive}
        onClose={() => setActiveOpen(false)}
      />

      {/* --------------------------------------------------------- delete */}
      <ConfirmDialog
        open={deleteOpen}
        title="Are you sure you want to delete this customer?"
        message={`${customer.firstName} ${customer.lastName} (${customer.email}) will be removed from the customer list, their wishlist and notifications will be cleared, and their email and mobile number will be freed up so they can register again. Appointment and review history is kept for the studio's records.`}
        confirmLabel="Yes, delete customer"
        cancelLabel="No, keep them"
        onConfirm={remove}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
