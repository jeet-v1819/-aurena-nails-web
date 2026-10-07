"use client";

/**
 * Admin dashboard — did not exist before.
 *
 * The README lists "Admin Dashboard with statistics" and "charts if already
 * implemented". The statistics endpoint (/api/admin/stats) was implemented; this
 * page renders it. The charts are the hand-rolled SVG components in
 * @/components/dashboard/charts — no charting library was added, per the
 * project's zero-extra-dependency rule.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import RoleGate from "@/components/dashboard/role-gate";
import StatCard, { StatGrid, icons } from "@/components/dashboard/stat-card";
import { BarChart, DonutChart, LineChart } from "@/components/dashboard/charts";
import { ErrorState, OrderStatusBadge, PageLoader, ProductStatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { ROLES, ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, primaryImage } from "@/utils/format";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await api.get("/api/admin/stats"));
    } catch (err) {
      // A 403 here means a non-admin reached the endpoint; RoleGate normally
      // stops that first, but the message is still worth surfacing.
      setError(err.message || "Could not load the dashboard statistics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const overview = stats?.overview || {};
  const deltas = stats?.deltas || {};
  const charts = stats?.charts || {};

  const statusDonut = (charts.orderStatus || []).map((row) => ({
    ...row,
    label: ORDER_STATUS_LABELS[row.status] || row.status,
  }));

  const topSellersSeries = {
    labels: (stats?.sellers || []).map((seller) => seller.name || "Unnamed"),
    keys: (stats?.sellers || []).map((seller) => seller.id),
    values: (stats?.sellers || []).map((seller) => Number(seller.revenue) || 0),
  };

  return (
    <RoleGate
      role={ROLES.ADMIN}
      title="Admin console"
      heading="Dashboard"
      description="Platform-wide performance across users, catalogue and orders."
      actions={
        <>
          <button type="button" onClick={load} className="btn-outline" disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <Link href="/admin/products" className="btn-primary">
            Manage products
          </Link>
        </>
      }
    >
      {loading && !stats ? (
        <PageLoader label="Crunching the numbers..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <StatGrid columns={4}>
            <StatCard
              label="Revenue"
              value={formatCurrency(overview.revenue)}
              hint="Completed orders, last 12 months"
              delta={deltas.revenue}
              icon={icons.money}
              tone="primary"
            />
            <StatCard
              label="Orders"
              value={overview.orders ?? 0}
              hint={`${overview.pendingOrders ?? 0} pending`}
              delta={deltas.orders}
              icon={icons.cart}
              tone="blue"
              href="/admin/orders"
            />
            <StatCard
              label="Users"
              value={overview.users ?? 0}
              hint={`${overview.customers ?? 0} customers · ${overview.disabledUsers ?? 0} disabled`}
              icon={icons.users}
              tone="purple"
              href="/admin/users"
            />
            <StatCard
              label="Products"
              value={overview.products ?? 0}
              hint={`${overview.activeProducts ?? 0} active · ${overview.outOfStockProducts ?? 0} out of stock`}
              icon={icons.box}
              tone="amber"
              href="/admin/products"
            />
          </StatGrid>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Sellers"
              value={overview.sellers ?? 0}
              hint={`${overview.activeSellers ?? 0} enabled`}
              icon={icons.store}
              tone="gray"
              href="/admin/sellers"
            />
            <StatCard label="Avg. order value" value={formatCurrency(overview.averageOrderValue)} hint="Across completed orders" icon={icons.chart} tone="primary" />
            <StatCard label="Cancelled orders" value={overview.cancelledOrders ?? 0} hint="Stock was returned on cancel" icon={icons.warning} tone="red" href="/admin/orders?status=CANCELLED" />
            <StatCard label="Pending fulfilment" value={overview.pendingOrders ?? 0} hint="Awaiting confirmation" icon={icons.clock} tone="amber" href="/admin/orders?status=PENDING" />
          </div>

          {/* Charts */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <LineChart series={charts.revenue} title="Revenue by month" format="currency" />
            <LineChart series={charts.orders} title="Orders by month" format="number" />
            <BarChart series={charts.products} title="Products by category" horizontal />
            <LineChart series={charts.users} title="New users by month" format="number" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <DonutChart data={statusDonut} title="Orders by status" />
            </div>
            <div className="lg:col-span-2">
              <BarChart series={topSellersSeries} title="Top sellers by revenue" format="currency" horizontal />
            </div>
          </div>

          {/* Tables */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Latest orders</h2>
                <Link href="/admin/orders" className="text-xs font-medium text-primary hover:underline">
                  View all →
                </Link>
              </div>
              {(stats?.latestOrders || []).length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">No orders yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="th">Order</th>
                        <th className="th">Customer</th>
                        <th className="th">Status</th>
                        <th className="th text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.latestOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="td">
                            <Link href={`/admin/orders?id=${order.id}`} className="font-medium text-primary hover:underline">
                              {order.orderNumber}
                            </Link>
                            <span className="block text-xs text-gray-400">{formatDate(order.orderDate)}</span>
                          </td>
                          <td className="td">
                            <span className="block truncate">{order.customer?.name || "—"}</span>
                            <span className="block truncate text-xs text-gray-400">{order.customer?.email}</span>
                          </td>
                          <td className="td">
                            <OrderStatusBadge value={order.status} />
                          </td>
                          <td className="td text-right font-medium">{formatCurrency(order.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Low stock</h2>
                <Link href="/admin/products" className="text-xs font-medium text-primary hover:underline">
                  Manage stock →
                </Link>
              </div>
              {(stats?.lowStock || []).length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">Nothing running low. 🎉</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {stats.lowStock.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <Link href={`/product/${item.id}`} className="block truncate text-sm font-medium text-gray-900 hover:text-primary hover:underline">
                          {item.name}
                        </Link>
                        <span className="block truncate text-xs text-gray-400">
                          {item.sku || "no SKU"} · {item.seller?.name || "unassigned"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <ProductStatusBadge value={item.status} />
                        <span className={`badge ${item.stock <= 0 ? "bg-red-100 text-danger" : "bg-amber-100 text-amber-800"}`}>
                          {item.stock} left
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="card mt-4 p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Best-selling products</h2>
              <Link href="/admin/products" className="text-xs font-medium text-primary hover:underline">
                All products →
              </Link>
            </div>
            {(stats?.products || []).length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">No sales recorded yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="th">Product</th>
                      <th className="th">Seller</th>
                      <th className="th text-right">Units sold</th>
                      <th className="th text-right">Revenue</th>
                      <th className="th text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.products.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="td">
                          <span className="flex items-center gap-2">
                            <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-gray-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={primaryImage(item.images)} alt="" className="h-full w-full object-cover" />
                            </span>
                            <Link href={`/product/${item.id}`} className="line-clamp-1 font-medium text-gray-900 hover:text-primary hover:underline">
                              {item.name}
                            </Link>
                          </span>
                        </td>
                        <td className="td text-gray-600">{item.sellerName || "—"}</td>
                        <td className="td text-right">{item.unitsSold}</td>
                        <td className="td text-right font-medium">{formatCurrency(item.revenue)}</td>
                        <td className="td text-right">
                          <span className={`badge ${item.stock <= 0 ? "bg-red-100 text-danger" : item.stock <= 5 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                            {item.stock}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {stats?.generatedAt && (
            <p className="mt-4 text-right text-xs text-gray-400">Statistics generated {formatDate(stats.generatedAt)}</p>
          )}
        </>
      )}
    </RoleGate>
  );
}
