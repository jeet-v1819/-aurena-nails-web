"use client";

/**
 * Admin → User management. Did not exist before.
 *
 * Covers the README's admin requirements: search/filter users, change roles,
 * enable/disable accounts and delete users. Every action hits /api/admin/users,
 * which is requireAdmin()-gated and refuses to let an admin demote, disable or
 * delete their own account. Deleting a user who owns products or orders returns
 * 409 with the counts; this page turns that into an explicit second confirmation
 * rather than silently forcing it.
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RoleGate from "@/components/dashboard/role-gate";
import { ErrorState, PageLoader, Pagination, RoleBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useToast } from "@/components/providers";
import { ROLES, ROLE_VALUES } from "@/lib/constants";
import { formatDate } from "@/utils/format";

function UsersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: toastError } = useToast();

  const page = Number(searchParams.get("page")) || 1;
  const urlRole = searchParams.get("role") || "";
  const urlStatus = searchParams.get("status") || "";
  const urlSearch = searchParams.get("search") || "";

  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState(urlSearch);
  const [busyId, setBusyId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // { user, force, counts }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/api/admin/users", {
        query: { page, role: urlRole, status: urlStatus, search: urlSearch, limit: 10 },
      });
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message || "Could not load users.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, urlRole, urlSearch, urlStatus]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the free-text box in sync when the URL changes (back/forward).
  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  async function changeRole(user, role) {
    setBusyId(user.id);
    try {
      await api.put("/api/admin/users", { id: user.id, role });
      success(`${user.name || user.email} is now a ${role.toLowerCase()}.`);
      await load();
    } catch (err) {
      toastError(err.message || "Could not change that role.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(user) {
    setBusyId(user.id);
    try {
      const next = !user.status;
      await api.put("/api/admin/users", { id: user.id, status: next });
      success(next ? `${user.email} can sign in again.` : `${user.email} has been disabled.`);
      await load();
    } catch (err) {
      toastError(err.message || "Could not update that account.");
    } finally {
      setBusyId(null);
    }
  }

  async function runDelete(force) {
    if (!confirmDelete) return;
    const user = confirmDelete.user;
    setBusyId(user.id);
    try {
      await api.del("/api/admin/users", { query: { id: user.id, force: force ? "1" : undefined } });
      success(`${user.email} has been deleted.`);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      if (err.status === 409 && !force) {
        // The account owns catalogue/order data — show what will be destroyed.
        setConfirmDelete({ user, force: true, counts: err.details || {}, message: err.message });
      } else {
        toastError(err.message || "Could not delete that user.");
      }
    } finally {
      setBusyId(null);
    }
  }

  const baseUrl = new URLSearchParams({ role: urlRole, status: urlStatus, search: urlSearch });
  const baseQuery = baseUrl.toString();

  return (
    <RoleGate
      role={ROLES.ADMIN}
      title="Admin console"
      heading="Users"
      description={`${total} account${total === 1 ? "" : "s"} match the current filters.`}
      actions={
        <Link href="/admin/sellers" className="btn-outline">
          Manage sellers
        </Link>
      }
    >
      {/* Filters — plain links so state lives in the URL and pagination keeps it */}
      <div className="card mb-4 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            // Route through the Next router (not window.history) so
            // useSearchParams() re-renders and load() picks up the new term.
            const params = new URLSearchParams({ role: urlRole, status: urlStatus, search: search.trim() });
            const qs = params.toString();
            router.push(qs ? `/admin/users?${qs}` : "/admin/users");
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-56 flex-1">
            <label htmlFor="u-search" className="label">
              Search
            </label>
            <input
              id="u-search"
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email or phone"
            />
          </div>

          <div>
            <span className="label">Role</span>
            <div className="flex gap-1">
              {["", ...ROLE_VALUES].map((value) => (
                <a
                  key={value || "all"}
                  href={`/admin/users?${new URLSearchParams({ role: value, status: urlStatus, search: urlSearch }).toString()}`}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    urlRole === value ? "border-primary bg-primary text-white" : "border-gray-300 text-gray-700 hover:border-primary hover:text-primary"
                  }`}
                >
                  {value ? value.charAt(0) + value.slice(1).toLowerCase() : "All"}
                </a>
              ))}
            </div>
          </div>

          <div>
            <span className="label">Status</span>
            <div className="flex gap-1">
              {[
                { value: "", label: "All" },
                { value: "true", label: "Enabled" },
                { value: "false", label: "Disabled" },
              ].map((option) => (
                <a
                  key={option.value || "all-status"}
                  href={`/admin/users?${new URLSearchParams({ role: urlRole, status: option.value, search: urlSearch }).toString()}`}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    urlStatus === option.value ? "border-primary bg-primary text-white" : "border-gray-300 text-gray-700 hover:border-primary hover:text-primary"
                  }`}
                >
                  {option.label}
                </a>
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary">
            Apply
          </button>
        </form>
      </div>

      {loading && users.length === 0 ? (
        <PageLoader label="Loading users..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : users.length === 0 ? (
        <div className="card p-10 text-center text-sm text-gray-500">No users match those filters.</div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="th">User</th>
                    <th className="th">Role</th>
                    <th className="th">Status</th>
                    <th className="th">Joined</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className={busyId === user.id ? "opacity-60" : ""}>
                      <td className="td">
                        <span className="block font-medium text-gray-900">{user.name || "Unnamed"}</span>
                        <span className="block text-xs text-gray-500">{user.email}</span>
                        {user.phone && <span className="block text-xs text-gray-400">{user.phone}</span>}
                      </td>
                      <td className="td">
                        <select
                          className="input w-auto py-1 text-xs"
                          value={user.role}
                          onChange={(event) => changeRole(user, event.target.value)}
                          disabled={busyId === user.id}
                          aria-label={`Role for ${user.email}`}
                        >
                          {ROLE_VALUES.map((value) => (
                            <option key={value} value={value}>
                              {value.charAt(0) + value.slice(1).toLowerCase()}
                            </option>
                          ))}
                        </select>
                        <div className="mt-1">
                          <RoleBadge value={user.role} />
                        </div>
                      </td>
                      <td className="td">
                        <button
                          type="button"
                          onClick={() => toggleStatus(user)}
                          disabled={busyId === user.id}
                          className={`badge cursor-pointer border-0 ${
                            user.status ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-danger hover:bg-red-200"
                          }`}
                          title={user.status ? "Click to disable" : "Click to enable"}
                        >
                          {user.status ? "Enabled" : "Disabled"}
                        </button>
                      </td>
                      <td className="td text-xs text-gray-500">{formatDate(user.createdAt, { dateStyle: "medium" })}</td>
                      <td className="td text-right">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete({ user, force: false })}
                          disabled={busyId === user.id}
                          className="btn-ghost px-2 py-1 text-sm text-danger hover:text-danger"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={page} totalPages={totalPages} baseUrl={`/admin/users${baseQuery ? `?${baseQuery}` : ""}`} />
        </>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="del-user-title">
          <div className="card w-full max-w-md p-6">
            <h2 id="del-user-title" className="text-lg font-semibold text-gray-900">
              {confirmDelete.force ? "This will delete real data" : "Delete this user?"}
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              {confirmDelete.user.email} ({String(confirmDelete.user.role).toLowerCase()})
            </p>

            {confirmDelete.force ? (
              <>
                <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">
                  {confirmDelete.message}
                </p>
                <ul className="mt-3 space-y-1 text-sm text-gray-700">
                  {typeof confirmDelete.counts?.products === "number" && (
                    <li>
                      <span className="font-semibold">{confirmDelete.counts.products}</span> product
                      {confirmDelete.counts.products === 1 ? "" : "s"} will be removed from the catalogue.
                    </li>
                  )}
                  {typeof confirmDelete.counts?.orders === "number" && (
                    <li>
                      <span className="font-semibold">{confirmDelete.counts.orders}</span> order
                      {confirmDelete.counts.orders === 1 ? "" : "s"} and their history will be deleted.
                    </li>
                  )}
                </ul>
                <p className="mt-2 text-xs text-gray-500">
                  The database cascades these deletes. Consider disabling the account instead.
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-gray-600">
                Their session ends immediately. If they own products or orders you will be asked to confirm again.
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="btn-outline" disabled={Boolean(busyId)}>
                Cancel
              </button>
              {confirmDelete.force ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      const target = confirmDelete.user;
                      setConfirmDelete(null);
                      await toggleStatus(target);
                    }}
                    className="btn-outline"
                    disabled={Boolean(busyId)}
                  >
                    Disable instead
                  </button>
                  <button type="button" onClick={() => runDelete(true)} className="btn-danger" disabled={Boolean(busyId)}>
                    {busyId ? "Deleting..." : "Delete everything"}
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => runDelete(false)} className="btn-danger" disabled={Boolean(busyId)}>
                  {busyId ? "Deleting..." : "Delete user"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </RoleGate>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading users..." />}>
      <UsersContent />
    </Suspense>
  );
}
