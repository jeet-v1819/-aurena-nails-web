"use client";

/**
 * Profile — did not exist before.
 *
 * The README lists "User profile management" for customers and "Seller
 * dashboard" for sellers. This page covers the account side for every role:
 * details, password, saved addresses and a role-aware activity summary. Role
 * consoles live at /admin and /seller.
 *
 * Everything goes through /api/users/me and /api/addresses, both of which scope
 * every query to the session user — there is no id in the URL to tamper with.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { EmptyState, ErrorState, FieldError, PageLoader, RoleBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useToast } from "@/components/providers";
import { formatCurrency, formatDate } from "@/utils/format";
import { ROLES } from "@/lib/constants";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "account", label: "Account details" },
  { id: "password", label: "Password" },
  { id: "addresses", label: "Addresses" },
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
  isDefault: false,
};

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession();
  const { success, error: toastError } = useToast();

  const [tab, setTab] = useState("overview");
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [account, setAccount] = useState({ name: "", email: "", phone: "", address: "" });
  const [accountErrors, setAccountErrors] = useState({});
  const [savingAccount, setSavingAccount] = useState(false);

  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);

  const [addressForm, setAddressForm] = useState(null);
  const [addressErrors, setAddressErrors] = useState({});
  const [savingAddress, setSavingAddress] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [me, addressData] = await Promise.all([
        api.get("/api/users/me"),
        api.get("/api/addresses").catch(() => ({ addresses: [] })),
      ]);
      setProfile(me);
      setAddresses(addressData.addresses || []);
      setAccount({
        name: me.user?.name || "",
        email: me.user?.email || "",
        phone: me.user?.phone || "",
        address: me.user?.address || "",
      });
    } catch (err) {
      setLoadError(err.message || "Could not load your profile.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveAccount(event) {
    event.preventDefault();
    setAccountErrors({});

    const errors = {};
    if (account.name.trim().length < 2) errors.name = "Please enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim())) errors.email = "Please enter a valid email address.";
    if (Object.keys(errors).length) {
      setAccountErrors(errors);
      return;
    }

    setSavingAccount(true);
    try {
      const data = await api.put("/api/users/me", {
        name: account.name.trim(),
        email: account.email.trim().toLowerCase(),
        phone: account.phone.trim(),
        address: account.address.trim(),
      });
      setProfile((current) => (current ? { ...current, user: data.user } : current));
      // Push the new name/email into the NextAuth session so the header updates.
      await updateSession({ name: data.user?.name, email: data.user?.email });
      success("Your profile has been updated.");
    } catch (err) {
      toastError(err.message || "Could not update your profile.");
      if (err.details) setAccountErrors(err.details);
    } finally {
      setSavingAccount(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setPasswordErrors({});

    const errors = {};
    if (!passwords.currentPassword) errors.currentPassword = "Enter your current password.";
    if (passwords.newPassword.length < 8) errors.newPassword = "New password must be at least 8 characters.";
    if (passwords.newPassword !== passwords.confirmPassword) errors.confirmPassword = "Passwords do not match.";
    if (passwords.newPassword && passwords.newPassword === passwords.currentPassword) {
      errors.newPassword = "Choose a password different from your current one.";
    }
    if (Object.keys(errors).length) {
      setPasswordErrors(errors);
      return;
    }

    setSavingPassword(true);
    try {
      await api.patch("/api/users/me", {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      success("Your password has been changed.");
    } catch (err) {
      toastError(err.message || "Could not change your password.");
      if (err.details) setPasswordErrors(err.details);
    } finally {
      setSavingPassword(false);
    }
  }

  async function saveAddress(event) {
    event.preventDefault();
    if (!addressForm) return;
    setAddressErrors({});

    const errors = {};
    if (!addressForm.fullName.trim()) errors.fullName = "Recipient name is required.";
    if (!addressForm.line1.trim()) errors.line1 = "Street address is required.";
    if (!addressForm.city.trim()) errors.city = "City is required.";
    if (!addressForm.state.trim()) errors.state = "State / region is required.";
    if (!addressForm.postalCode.trim()) errors.postalCode = "Postal code is required.";
    if (Object.keys(errors).length) {
      setAddressErrors(errors);
      return;
    }

    setSavingAddress(true);
    try {
      const payload = {
        fullName: addressForm.fullName.trim(),
        phone: addressForm.phone.trim(),
        line1: addressForm.line1.trim(),
        line2: addressForm.line2.trim(),
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        postalCode: addressForm.postalCode.trim(),
        country: addressForm.country.trim() || "India",
        label: addressForm.label.trim(),
        isDefault: Boolean(addressForm.isDefault),
      };

      const data = addressForm.id
        ? await api.put("/api/addresses", { id: addressForm.id, ...payload })
        : await api.post("/api/addresses", payload);

      const wasEdit = Boolean(addressForm.id);
      setAddressForm(null);
      success(wasEdit ? "Address updated." : "Address saved.");
      // Re-read: marking an address default clears the flag on the others.
      await load();
    } catch (err) {
      toastError(err.message || "Could not save that address.");
      if (err.details) setAddressErrors(err.details);
    } finally {
      setSavingAddress(false);
    }
  }

  async function removeAddress(address) {
    setDeletingId(address.id);
    try {
      await api.del("/api/addresses", { query: { id: address.id } });
      setAddresses((current) => current.filter((row) => row.id !== address.id));
      success("Address removed.");
    } catch (err) {
      toastError(err.message || "Could not remove that address.");
    } finally {
      setDeletingId(null);
    }
  }

  if (status === "loading" || loading) return <PageLoader label="Loading your profile..." />;

  if (status !== "authenticated") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <EmptyState
          title="Sign in to view your profile"
          action={
            <Link href="/login?callbackUrl=/profile" className="btn-primary">
              Sign in
            </Link>
          }
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <ErrorState message={loadError} onRetry={load} />
      </div>
    );
  }

  const user = profile?.user || session?.user || {};
  const summary = profile?.summary || {};
  const role = user.role || ROLES.CUSTOMER;
  const consoleHref = role === ROLES.ADMIN ? "/admin" : role === ROLES.SELLER ? "/seller" : null;

  const summaryCards =
    summary.scope === "admin"
      ? [
          { label: "Users", value: summary.users, href: "/admin/users" },
          { label: "Sellers", value: summary.sellers, href: "/admin/sellers" },
          { label: "Products", value: summary.products, href: "/admin/products" },
          { label: "Orders", value: summary.orders, href: "/admin/orders" },
          { label: "Revenue", value: formatCurrency(summary.revenue) },
        ]
      : summary.scope === "seller"
        ? [
            { label: "Products", value: summary.products, href: "/seller/products" },
            { label: "Active", value: summary.activeProducts },
            { label: "Orders", value: summary.orders, href: "/seller/orders" },
            { label: "Pending", value: summary.pendingOrders, href: "/seller/orders?status=PENDING" },
            { label: "Revenue", value: formatCurrency(summary.revenue) },
          ]
        : [
            { label: "Orders", value: summary.orders, href: "/orders" },
            { label: "Reviews", value: summary.reviews },
            { label: "Wishlist", value: summary.wishlistItems, href: "/wishlist" },
            { label: "Cart items", value: summary.cartItems, href: "/cart" },
            { label: "Total spent", value: formatCurrency(summary.totalSpent) },
          ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <header className="card flex flex-wrap items-center gap-4 p-6">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-white" aria-hidden="true">
          {(user.name || user.email || "?").charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold text-gray-900">{user.name || "Unnamed account"}</h1>
            <RoleBadge value={role} />
            {user.status === false && <span className="badge bg-red-100 text-danger">Disabled</span>}
          </div>
          <p className="mt-0.5 truncate text-sm text-gray-500">{user.email}</p>
          {user.createdAt && <p className="mt-0.5 text-xs text-gray-400">Member since {formatDate(user.createdAt, { dateStyle: "long" })}</p>}
        </div>
        <div className="flex flex-col gap-2">
          {consoleHref && (
            <Link href={consoleHref} className="btn-primary px-4 py-2">
              Open {role === ROLES.ADMIN ? "admin" : "seller"} console
            </Link>
          )}
          <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="btn-outline px-4 py-2">
            Sign out
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-gray-200" role="tablist" aria-label="Profile sections">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === entry.id ? "border-primary text-primary" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            {entry.label}
            {entry.id === "addresses" && addresses.length > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{addresses.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <section>
            <h2 className="text-base font-semibold text-gray-900">
              {summary.scope === "admin" ? "Platform at a glance" : summary.scope === "seller" ? "Your storefront" : "Your activity"}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {summaryCards.map((card) => (
                <div key={card.label} className="card p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{card.label}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{card.value ?? 0}</p>
                  {card.href && (
                    <Link href={card.href} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                      View →
                    </Link>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Link href="/orders" className="card p-5 transition-shadow hover:shadow-md">
                <h3 className="text-sm font-semibold text-gray-900">Order history</h3>
                <p className="mt-1 text-xs text-gray-500">Track deliveries and cancel orders that have not shipped.</p>
              </Link>
              <Link href="/wishlist" className="card p-5 transition-shadow hover:shadow-md">
                <h3 className="text-sm font-semibold text-gray-900">Wishlist</h3>
                <p className="mt-1 text-xs text-gray-500">Move saved items to your cart when you are ready.</p>
              </Link>
            </div>
          </section>
        )}

        {tab === "account" && (
          <section className="card max-w-2xl p-6">
            <h2 className="text-base font-semibold text-gray-900">Account details</h2>
            <p className="mt-1 text-sm text-gray-500">
              Your role can only be changed by an administrator. Changing your email signs you in under the same account.
            </p>

            <form onSubmit={saveAccount} className="mt-5 grid gap-4 sm:grid-cols-2" noValidate>
              <div className="sm:col-span-2">
                <label htmlFor="name" className="label">
                  Full name
                </label>
                <input
                  id="name"
                  className="input"
                  value={account.name}
                  onChange={(event) => setAccount((c) => ({ ...c, name: event.target.value }))}
                  autoComplete="name"
                  disabled={savingAccount}
                />
                <FieldError>{accountErrors.name}</FieldError>
              </div>

              <div>
                <label htmlFor="email" className="label">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  value={account.email}
                  onChange={(event) => setAccount((c) => ({ ...c, email: event.target.value }))}
                  autoComplete="email"
                  disabled={savingAccount}
                />
                <FieldError>{accountErrors.email}</FieldError>
              </div>

              <div>
                <label htmlFor="phone" className="label">
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  className="input"
                  value={account.phone || ""}
                  onChange={(event) => setAccount((c) => ({ ...c, phone: event.target.value }))}
                  autoComplete="tel"
                  disabled={savingAccount}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="address" className="label">
                  Bio / short address note <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="address"
                  rows={2}
                  className="input resize-y"
                  value={account.address || ""}
                  onChange={(event) => setAccount((c) => ({ ...c, address: event.target.value }))}
                  disabled={savingAccount}
                />
              </div>

              <div className="sm:col-span-2">
                <button type="submit" disabled={savingAccount} className="btn-primary">
                  {savingAccount ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        )}

        {tab === "password" && (
          <section className="card max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900">Change password</h2>
            <p className="mt-1 text-sm text-gray-500">
              Passwords are hashed with bcrypt before storage. You will stay signed in on this device.
            </p>

            <form onSubmit={savePassword} className="mt-5 space-y-4" noValidate>
              <div>
                <label htmlFor="currentPassword" className="label">
                  Current password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  className="input"
                  value={passwords.currentPassword}
                  onChange={(event) => setPasswords((c) => ({ ...c, currentPassword: event.target.value }))}
                  autoComplete="current-password"
                  disabled={savingPassword}
                />
                <FieldError>{passwordErrors.currentPassword}</FieldError>
              </div>

              <div>
                <label htmlFor="newPassword" className="label">
                  New password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  className="input"
                  value={passwords.newPassword}
                  onChange={(event) => setPasswords((c) => ({ ...c, newPassword: event.target.value }))}
                  autoComplete="new-password"
                  minLength={8}
                  disabled={savingPassword}
                />
                <FieldError>{passwordErrors.newPassword}</FieldError>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="input"
                  value={passwords.confirmPassword}
                  onChange={(event) => setPasswords((c) => ({ ...c, confirmPassword: event.target.value }))}
                  autoComplete="new-password"
                  minLength={8}
                  disabled={savingPassword}
                />
                <FieldError>{passwordErrors.confirmPassword}</FieldError>
              </div>

              <button type="submit" disabled={savingPassword} className="btn-primary w-full py-2.5">
                {savingPassword ? "Updating..." : "Update password"}
              </button>
            </form>
          </section>
        )}

        {tab === "addresses" && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Saved addresses</h2>
                <p className="text-sm text-gray-500">Used to pre-fill checkout.</p>
              </div>
              {!addressForm && (
                <button type="button" onClick={() => setAddressForm({ ...EMPTY_ADDRESS })} className="btn-primary">
                  Add address
                </button>
              )}
            </div>

            {addressForm && (
              <form onSubmit={saveAddress} className="card mt-4 max-w-2xl p-5" noValidate>
                <h3 className="text-sm font-semibold text-gray-900">{addressForm.id ? "Edit address" : "New address"}</h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="a-fullName" className="label">
                      Full name
                    </label>
                    <input
                      id="a-fullName"
                      className="input"
                      value={addressForm.fullName}
                      onChange={(event) => setAddressForm((c) => ({ ...c, fullName: event.target.value }))}
                      disabled={savingAddress}
                    />
                    <FieldError>{addressErrors.fullName}</FieldError>
                  </div>

                  <div>
                    <label htmlFor="a-phone" className="label">
                      Phone
                    </label>
                    <input
                      id="a-phone"
                      className="input"
                      value={addressForm.phone || ""}
                      onChange={(event) => setAddressForm((c) => ({ ...c, phone: event.target.value }))}
                      disabled={savingAddress}
                    />
                  </div>

                  <div>
                    <label htmlFor="a-label" className="label">
                      Label
                    </label>
                    <input
                      id="a-label"
                      className="input"
                      value={addressForm.label || ""}
                      onChange={(event) => setAddressForm((c) => ({ ...c, label: event.target.value }))}
                      placeholder="Home, Work..."
                      disabled={savingAddress}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="a-line1" className="label">
                      Address line 1
                    </label>
                    <input
                      id="a-line1"
                      className="input"
                      value={addressForm.line1}
                      onChange={(event) => setAddressForm((c) => ({ ...c, line1: event.target.value }))}
                      disabled={savingAddress}
                    />
                    <FieldError>{addressErrors.line1}</FieldError>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="a-line2" className="label">
                      Address line 2 <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <input
                      id="a-line2"
                      className="input"
                      value={addressForm.line2 || ""}
                      onChange={(event) => setAddressForm((c) => ({ ...c, line2: event.target.value }))}
                      disabled={savingAddress}
                    />
                  </div>

                  <div>
                    <label htmlFor="a-city" className="label">
                      City
                    </label>
                    <input
                      id="a-city"
                      className="input"
                      value={addressForm.city}
                      onChange={(event) => setAddressForm((c) => ({ ...c, city: event.target.value }))}
                      disabled={savingAddress}
                    />
                    <FieldError>{addressErrors.city}</FieldError>
                  </div>

                  <div>
                    <label htmlFor="a-state" className="label">
                      State / region
                    </label>
                    <input
                      id="a-state"
                      className="input"
                      value={addressForm.state}
                      onChange={(event) => setAddressForm((c) => ({ ...c, state: event.target.value }))}
                      disabled={savingAddress}
                    />
                    <FieldError>{addressErrors.state}</FieldError>
                  </div>

                  <div>
                    <label htmlFor="a-postalCode" className="label">
                      Postal code
                    </label>
                    <input
                      id="a-postalCode"
                      className="input"
                      value={addressForm.postalCode}
                      onChange={(event) => setAddressForm((c) => ({ ...c, postalCode: event.target.value }))}
                      disabled={savingAddress}
                    />
                    <FieldError>{addressErrors.postalCode}</FieldError>
                  </div>

                  <div>
                    <label htmlFor="a-country" className="label">
                      Country
                    </label>
                    <input
                      id="a-country"
                      className="input"
                      value={addressForm.country || ""}
                      onChange={(event) => setAddressForm((c) => ({ ...c, country: event.target.value }))}
                      disabled={savingAddress}
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={Boolean(addressForm.isDefault)}
                      onChange={(event) => setAddressForm((c) => ({ ...c, isDefault: event.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      disabled={savingAddress}
                    />
                    Make this my default address
                  </label>
                </div>

                <div className="mt-5 flex gap-2">
                  <button type="submit" disabled={savingAddress} className="btn-primary">
                    {savingAddress ? "Saving..." : "Save address"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddressForm(null);
                      setAddressErrors({});
                    }}
                    disabled={savingAddress}
                    className="btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {addresses.length === 0 && !addressForm ? (
              <div className="mt-4">
                <EmptyState
                  title="No saved addresses"
                  message="Add one to speed up checkout. Addresses saved during checkout also appear here."
                />
              </div>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {addresses.map((address) => (
                  <li key={address.id} className="card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
                          {address.label || "Address"}
                          {address.isDefault && <span className="badge bg-green-100 text-green-800">Default</span>}
                        </p>
                        <address className="mt-1 space-y-0.5 text-sm not-italic text-gray-600">
                          <span className="block">{address.fullName}</span>
                          {address.phone && <span className="block">{address.phone}</span>}
                          <span className="block">{address.line1}</span>
                          {address.line2 && <span className="block">{address.line2}</span>}
                          <span className="block">
                            {address.city}, {address.state} {address.postalCode}
                          </span>
                          <span className="block">{address.country}</span>
                        </address>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setAddressErrors({});
                          setAddressForm({ ...EMPTY_ADDRESS, ...address });
                          setTab("addresses");
                        }}
                        className="btn-outline px-3 py-1.5 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAddress(address)}
                        disabled={deletingId === address.id}
                        className="btn-ghost px-3 py-1.5 text-sm text-danger hover:text-danger"
                      >
                        {deletingId === address.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
