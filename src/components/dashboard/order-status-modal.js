"use client";

/**
 * Update-order-status dialog shared by /admin/orders and /seller/orders.
 *
 * It offers only the transitions the server will actually accept: the choice
 * list comes from allowedNextStatuses() in @/lib/constants, which mirrors
 * orderService.updateOrderStatus(). Sellers additionally cannot pick REFUNDED
 * (enforced again server-side), and only admins get the "force" escape hatch for
 * correcting data that is already in an illegal state.
 */
import { useEffect, useMemo, useState } from "react";
import { FieldError } from "@/components/ui";
import { useToast } from "@/components/providers";
import { api } from "@/lib/api";
import { ORDER_STATUS, ORDER_STATUS_LABELS, ROLES, allowedNextStatuses } from "@/lib/constants";
import { formatCurrency } from "@/utils/format";

export default function OrderStatusModal({ open, order, role, endpoint = "/api/orders", onClose, onSaved }) {
  const { success, error: toastError } = useToast();
  const isAdmin = role === ROLES.ADMIN;

  const options = useMemo(() => (order ? allowedNextStatuses(order.status, { role }) : []), [order, role]);

  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [force, setForce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!open || !order) return;
    setStatus(options[0] || order.status);
    setNote("");
    setTrackingNumber(order.trackingNumber || "");
    setForce(false);
    setFieldErrors({});
  }, [open, order, options]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !order) return null;

  const needsTracking = status === ORDER_STATUS.SHIPPED;
  const isCancellation = status === ORDER_STATUS.CANCELLED;
  const noChoices = options.length === 0;

  async function handleSubmit(event) {
    event.preventDefault();

    const errors = {};
    if (!status) errors.status = "Choose a status.";
    if (needsTracking && !trackingNumber.trim()) {
      errors.trackingNumber = "A tracking number is required when marking an order as shipped.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    try {
      const id = order.id;
      const data = await api.put(endpoint, {
        id,
        status,
        note: note.trim() || undefined,
        trackingNumber: trackingNumber.trim() || undefined,
        force: isAdmin ? force : undefined,
      });
      success(data.message || `Order marked ${ORDER_STATUS_LABELS[status] || status}.`);
      onSaved?.(data.order || null);
      onClose?.();
    } catch (err) {
      toastError(err.message || "Could not update this order.");
      if (err.details) setFieldErrors(err.details);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-status-title"
    >
      <form onSubmit={handleSubmit} className="card my-8 w-full max-w-lg p-6" noValidate>
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="order-status-title" className="text-lg font-semibold text-gray-900">
              Update order status
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {order.orderNumber} · {formatCurrency(order.total)}
              {order.customer?.name && <> · {order.customer.name}</>}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost h-8 w-8 rounded-full p-0">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Current status: <span className="font-semibold text-gray-900">{ORDER_STATUS_LABELS[order.status] || order.status}</span>
          {!isAdmin && " · sellers can confirm, process, ship, deliver and cancel, but not refund."}
        </p>

        {noChoices ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This order is in a terminal state ({ORDER_STATUS_LABELS[order.status] || order.status}) and cannot move
            further{isAdmin ? " without forcing a change" : ""}.
          </p>
        ) : (
          <div className="mt-4">
            <label htmlFor="os-status" className="label">
              New status
            </label>
            <select
              id="os-status"
              className="input"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              disabled={saving}
            >
              {options.map((value) => (
                <option key={value} value={value}>
                  {ORDER_STATUS_LABELS[value] || value}
                </option>
              ))}
            </select>
            <FieldError>{fieldErrors.status}</FieldError>
          </div>
        )}

        {needsTracking && (
          <div className="mt-4">
            <label htmlFor="os-tracking" className="label">
              Tracking number
            </label>
            <input
              id="os-tracking"
              className="input font-mono text-sm"
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              placeholder="AWB1234567890"
              disabled={saving}
            />
            <FieldError>{fieldErrors.trackingNumber}</FieldError>
            <p className="mt-1 text-xs text-gray-500">Shown to the customer on their tracking timeline.</p>
          </div>
        )}

        <div className="mt-4">
          <label htmlFor="os-note" className="label">
            Note <span className="font-normal text-gray-400">(added to the timeline{isCancellation ? " and emailed in spirit" : ""})</span>
          </label>
          <textarea
            id="os-note"
            rows={2}
            maxLength={500}
            className="input resize-y"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={isCancellation ? "Out of stock — refund initiated." : "Packed and handed to the courier."}
            disabled={saving}
          />
        </div>

        {isCancellation && (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Cancelling returns every item on this order to the seller&apos;s stock.
          </p>
        )}

        {isAdmin && (
          <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={force}
              onChange={(event) => setForce(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              disabled={saving}
            />
            <span>
              <span className="block font-medium">Force this change</span>
              <span className="mt-0.5 block text-xs text-gray-500">
                Bypasses the transition map. Use only to correct data — every change is still recorded on the timeline.
              </span>
            </span>
          </label>
        )}

        <footer className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button type="button" onClick={onClose} className="btn-outline" disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving || noChoices}>
            {saving ? "Updating..." : "Update status"}
          </button>
        </footer>
      </form>
    </div>
  );
}
