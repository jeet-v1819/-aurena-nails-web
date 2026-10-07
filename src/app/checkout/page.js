"use client";

/**
 * Checkout: shipping information -> (simulated) payment -> order confirmation.
 *
 * This page did not exist. The README lists "Checkout: Shipping information,
 * payment processing, order confirmation" and orderService.createOrder() was
 * implemented, but there was no UI and no /api/orders endpoint to call, so the
 * customer flow dead-ended at the cart.
 *
 * PAYMENT: there is NO real payment gateway in this project and none has been
 * added. The payment step is an explicit simulation — choosing "Card" or "UPI"
 * records a label only, never collects card data and never contacts a processor.
 * This is stated in the UI so nobody mistakes it for live payment processing.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Navigation from "@/components/navigation";
import { EmptyState, ErrorState, FieldError, PageLoader } from "@/components/ui";
import { api } from "@/lib/api";
import { notifyCountsChanged } from "@/lib/useShopActions";
import { useToast } from "@/components/providers";
import { formatCurrency, primaryImage } from "@/utils/format";

const PAYMENT_OPTIONS = [
  {
    value: "MOCK",
    label: "Simulated payment",
    hint: "Instantly marked as paid. No gateway is contacted.",
  },
  { value: "COD", label: "Cash on delivery", hint: "Pay the courier when your order arrives." },
  { value: "CARD", label: "Card (simulated)", hint: "Recorded as a label only — no card details are collected." },
  { value: "UPI", label: "UPI (simulated)", hint: "Recorded as a label only — no UPI collect request is made." },
];

const EMPTY_ADDRESS = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  label: "Home",
};

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { success } = useToast();

  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [fieldErrors, setFieldErrors] = useState({});
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [saveAddress, setSaveAddress] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("MOCK");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const isAuthenticated = status === "authenticated";

  const load = useCallback(async () => {
    if (status === "loading") return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const [cartData, addressData] = await Promise.all([
        api.get("/api/cart"),
        api.get("/api/addresses").catch(() => ({ addresses: [] })),
      ]);

      setCart(cartData);
      const saved = addressData.addresses || [];
      setAddresses(saved);

      const preferred = saved.find((address) => address.isDefault) || saved[0];
      if (preferred) {
        setSelectedAddressId(preferred.id);
        setForm({
          fullName: preferred.fullName || "",
          phone: preferred.phone || "",
          line1: preferred.line1 || "",
          line2: preferred.line2 || "",
          city: preferred.city || "",
          state: preferred.state || "",
          postalCode: preferred.postalCode || "",
          country: preferred.country || "India",
          label: preferred.label || "Home",
        });
      } else if (session?.user?.name) {
        setForm((current) => ({ ...current, fullName: session.user.name, phone: session.user.phone || "" }));
      }
    } catch (err) {
      setLoadError(err.message || "Could not load your cart.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, session?.user?.name, session?.user?.phone, status]);

  useEffect(() => {
    load();
  }, [load]);

  const sellerCount = useMemo(() => {
    const ids = new Set((cart?.items || []).map((item) => item.sellerId).filter(Boolean));
    return ids.size;
  }, [cart]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  }

  function useSavedAddress(id) {
    setSelectedAddressId(id);
    const saved = addresses.find((address) => address.id === id);
    if (!saved) return;
    setForm({
      fullName: saved.fullName || "",
      phone: saved.phone || "",
      line1: saved.line1 || "",
      line2: saved.line2 || "",
      city: saved.city || "",
      state: saved.state || "",
      postalCode: saved.postalCode || "",
      country: saved.country || "India",
      label: saved.label || "Home",
    });
  }

  function validate() {
    const errors = {};
    if (!form.fullName.trim()) errors.fullName = "Please enter the recipient's full name.";
    if (!form.line1.trim()) errors.line1 = "Street address is required.";
    if (!form.city.trim()) errors.city = "City is required.";
    if (!form.state.trim()) errors.state = "State / region is required.";
    if (!form.postalCode.trim()) errors.postalCode = "Postal code is required.";
    if (form.phone && !/^[0-9+()\-\s]{6,20}$/.test(form.phone.trim())) {
      errors.phone = "Please enter a valid phone number.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function placeOrder(event) {
    event.preventDefault();
    setSubmitError("");

    if (!validate()) {
      setSubmitError("Please correct the highlighted fields.");
      return;
    }

    setPlacing(true);
    try {
      const result = await api.post("/api/orders", {
        shippingAddress: {
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || undefined,
          line1: form.line1.trim(),
          line2: form.line2.trim() || undefined,
          city: form.city.trim(),
          state: form.state.trim(),
          postalCode: form.postalCode.trim(),
          country: form.country.trim() || "India",
          label: form.label.trim() || "Home",
        },
        // Only link the saved row if the shopper did not edit the fields.
        shippingAddressId: selectedAddressId || null,
        paymentMethod,
        notes: notes.trim() || undefined,
        saveAddress,
      });

      notifyCountsChanged();
      success("Your order has been placed.", { title: "Thank you!" });

      const firstId = result.orderIds?.[0];
      router.push(firstId ? `/orders/${firstId}?placed=1&count=${result.orderIds.length}` : "/orders?placed=1");
    } catch (err) {
      setSubmitError(err.message || "Could not place your order.");
      if (err.details) setFieldErrors(err.details);
      // Stock may have changed — refresh the cart so the totals stay truthful.
      load();
    } finally {
      setPlacing(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <>
        <Navigation />
        <PageLoader label="Preparing checkout..." />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Navigation />
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <EmptyState
            title="Sign in to check out"
            message="We need your account to attach the order to you and to save your shipping details."
            action={
              <Link href="/login?callbackUrl=/checkout" className="btn-primary">
                Sign in
              </Link>
            }
          />
        </div>
      </>
    );
  }

  const items = cart?.items || [];

  if (loadError) {
    return (
      <>
        <Navigation />
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <ErrorState message={loadError} onRetry={load} />
        </div>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <Navigation />
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <EmptyState
            title="Your cart is empty"
            message="Add a product before checking out."
            action={
              <Link href="/products" className="btn-primary">
                Browse products
              </Link>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review your shipping details and place your order.
          {sellerCount > 1 && ` This cart spans ${sellerCount} sellers, so it will be split into ${sellerCount} orders.`}
        </p>

        <form onSubmit={placeOrder} className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Shipping address */}
            <section className="card p-5">
              <h2 className="text-base font-semibold text-gray-900">Shipping information</h2>

              {addresses.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {addresses.map((address) => {
                    const active = selectedAddressId === address.id;
                    return (
                      <button
                        key={address.id}
                        type="button"
                        onClick={() => useSavedAddress(address.id)}
                        aria-pressed={active}
                        className={`rounded-md border p-3 text-left text-sm transition-colors ${
                          active ? "border-primary bg-green-50" : "border-gray-200 hover:border-primary"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-900">{address.label || "Address"}</span>
                          {address.isDefault && <span className="badge bg-gray-100 text-gray-600">Default</span>}
                        </span>
                        <span className="mt-1 block truncate text-xs text-gray-500">
                          {address.line1}, {address.city}, {address.state} {address.postalCode}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="fullName" className="label">
                    Full name <span className="text-danger">*</span>
                  </label>
                  <input
                    id="fullName"
                    className="input"
                    value={form.fullName}
                    onChange={(event) => setField("fullName", event.target.value)}
                    autoComplete="name"
                    required
                  />
                  <FieldError>{fieldErrors.fullName}</FieldError>
                </div>

                <div>
                  <label htmlFor="phone" className="label">
                    Phone <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="phone"
                    className="input"
                    value={form.phone}
                    onChange={(event) => setField("phone", event.target.value)}
                    autoComplete="tel"
                    placeholder="+91 98765 43210"
                  />
                  <FieldError>{fieldErrors.phone}</FieldError>
                </div>

                <div>
                  <label htmlFor="postalCode" className="label">
                    Postal code <span className="text-danger">*</span>
                  </label>
                  <input
                    id="postalCode"
                    className="input"
                    value={form.postalCode}
                    onChange={(event) => setField("postalCode", event.target.value)}
                    autoComplete="postal-code"
                    required
                  />
                  <FieldError>{fieldErrors.postalCode}</FieldError>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="line1" className="label">
                    Address line 1 <span className="text-danger">*</span>
                  </label>
                  <input
                    id="line1"
                    className="input"
                    value={form.line1}
                    onChange={(event) => setField("line1", event.target.value)}
                    autoComplete="address-line1"
                    placeholder="123 Main St"
                    required
                  />
                  <FieldError>{fieldErrors.line1}</FieldError>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="line2" className="label">
                    Address line 2 <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="line2"
                    className="input"
                    value={form.line2}
                    onChange={(event) => setField("line2", event.target.value)}
                    autoComplete="address-line2"
                    placeholder="Apartment, suite, unit"
                  />
                </div>

                <div>
                  <label htmlFor="city" className="label">
                    City <span className="text-danger">*</span>
                  </label>
                  <input
                    id="city"
                    className="input"
                    value={form.city}
                    onChange={(event) => setField("city", event.target.value)}
                    autoComplete="address-level2"
                    required
                  />
                  <FieldError>{fieldErrors.city}</FieldError>
                </div>

                <div>
                  <label htmlFor="state" className="label">
                    State / region <span className="text-danger">*</span>
                  </label>
                  <input
                    id="state"
                    className="input"
                    value={form.state}
                    onChange={(event) => setField("state", event.target.value)}
                    autoComplete="address-level1"
                    required
                  />
                  <FieldError>{fieldErrors.state}</FieldError>
                </div>

                <div>
                  <label htmlFor="country" className="label">
                    Country
                  </label>
                  <input
                    id="country"
                    className="input"
                    value={form.country}
                    onChange={(event) => setField("country", event.target.value)}
                    autoComplete="country-name"
                  />
                </div>

                <div>
                  <label htmlFor="label" className="label">
                    Save as
                  </label>
                  <input
                    id="label"
                    className="input"
                    value={form.label}
                    onChange={(event) => setField("label", event.target.value)}
                    placeholder="Home, Work..."
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(event) => setSaveAddress(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  Save this address to my profile for next time
                </label>
              </div>
            </section>

            {/* Payment */}
            <section className="card p-5">
              <h2 className="text-base font-semibold text-gray-900">Payment method</h2>

              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <strong>Demo environment.</strong> No payment gateway is configured in this project. Every option below
                is simulated — no card details, UPI handles or bank credentials are collected, and no processor is
                contacted.
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {PAYMENT_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                      paymentMethod === option.value ? "border-primary bg-green-50" : "border-gray-200 hover:border-primary"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={option.value}
                      checked={paymentMethod === option.value}
                      onChange={() => setPaymentMethod(option.value)}
                      className="mt-0.5 h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-gray-500">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              <label htmlFor="notes" className="label mt-4">
                Order notes <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                id="notes"
                rows={2}
                maxLength={1000}
                className="input resize-y"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Delivery instructions, gift message..."
              />
            </section>
          </div>

          {/* Summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900">Your order</h2>

              <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={primaryImage(item.image)} alt={item.name} className="h-full w-full object-cover" />
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] font-bold text-white">
                        {item.quantity}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-sm text-gray-900">{item.name}</span>
                      {item.sellerName && <span className="block text-xs text-gray-500">Sold by {item.sellerName}</span>}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-gray-900">{formatCurrency(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>

              <dl className="mt-4 space-y-2 border-t border-gray-200 pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Subtotal</dt>
                  <dd className="font-medium text-gray-900">{formatCurrency(cart?.subtotal)}</dd>
                </div>
                {Number(cart?.discount) > 0 && (
                  <div className="flex justify-between text-green-700">
                    <dt>Discount</dt>
                    <dd className="font-medium">−{formatCurrency(cart?.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-600">Shipping</dt>
                  <dd className="font-medium text-gray-900">
                    {Number(cart?.shipping) === 0 ? <span className="text-green-700">Free</span> : formatCurrency(cart?.shipping)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Tax</dt>
                  <dd className="font-medium text-gray-900">{formatCurrency(cart?.tax)}</dd>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 text-base">
                  <dt className="font-semibold text-gray-900">Total</dt>
                  <dd className="font-bold text-primary">{formatCurrency(cart?.total)}</dd>
                </div>
              </dl>

              {submitError && (
                <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-danger" role="alert">
                  {submitError}
                </p>
              )}

              {cart?.hasIssues && (
                <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Some items are unavailable or exceed stock.{" "}
                  <Link href="/cart" className="font-medium underline">
                    Review your cart
                  </Link>
                  .
                </p>
              )}

              <button type="submit" disabled={placing || Boolean(cart?.hasIssues)} className="btn-primary mt-4 w-full py-2.5">
                {placing ? "Placing your order..." : `Place order — ${formatCurrency(cart?.total)}`}
              </button>

              <Link href="/cart" className="mt-3 block text-center text-sm text-gray-500 hover:text-primary hover:underline">
                Back to cart
              </Link>
            </div>
          </aside>
        </form>
      </div>
    </>
  );
}
