"use client";

/**
 * Seller dashboard — did not exist before.
 *
 * The README lists: seller dashboard, view own products only, view seller
 * orders, and sales/revenue statistics. The statistics endpoint
 * (/api/seller/stats) was implemented and scopes every query to the session's
 * sellerId, so this page can only ever show the signed-in seller's own numbers.
 *
 * Charts are the dependency-free SVG components in @/components/dashboard/charts.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import RoleGate from "@/components/dashboard/role-gate";
import StatCard, { StatGrid, icons } from "@/components/dashboard/stat-card";
import { BarChart, DonutChart, LineChart } from "@/components/dashboard/charts";
import { ErrorState, OrderStatusBadge, PageLoader, ProductStatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { ORDER_STATUS_LABELS, ROLES } from "@/lib/constants";
import { formatCurrency, formatDate, primaryImage } from "@/utils/format";

export default function SellerDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await api.get("/api/seller/stats"));
    } catch (err) {
      setError(err.message || "Could not load your dashboard.");
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

  const bestSellersSeries = {
    labels: (stats?.bestSellers || []).map((item) => item.name),
    keys: (stats?.bestSellers || []).map((item) => item.id),
    values: (stats?.bestSellers || []).map((item) => Number(item.revenue) || 0),
  };

  return (
    <RoleGate
      role={ROLES.SELLER}
      title="Seller console"
      heading="Dashboard"
      description={
        stats?.seller?.name
          ? `Performance for ${stats.seller.name}. You only ever see your own products and orders.`
          : "Your sales, revenue and fulfilment at a glance."
      }
      actions={
        <>
          <button type="button" onClick={load} className="btn-outline" disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <Link href="/seller/products" className="btn-primary">
            Manage products
          </Link>
        </>
      }
    >
      {loading && !stats ? (
        <PageLoader label="Loading your dashboard..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <StatGrid columns={4}>
            <StatCard
              label="Revenue"
              value={formatCurrency(overview.revenue)}
              hint="Last 12 months, excluding cancellations"
              delta={deltas.revenue}
              icon={icons.money}
              tone="primary"
            />
            <StatCard
              label="Orders"
              value={overview.orders ?? 0}
              hint={`${overview.periodOrders ?? 0} in the last 12 months`}
              delta={deltas.orders}
              icon={icons.cart}
              tone="blue"
              href="/seller/orders"
            />
            <StatCard
              label="Units sold"
              value={overview.unitsSold ?? 0}
              hint="Across all fulfilled orders"
              icon={icons.chart}
              tone="purple"
            />
            <StatCard
              label="Products"
              value={overview.products ?? 0}
              hint={`${overview.activeProducts ?? 0} active · ${overview.inactiveProducts ?? 0} hidden`}
              icon={icons.box}
              tone="amber"
              href="/seller/products"
            />
          </StatGrid>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Awaiting action"
              value={overview.pendingOrders ?? 0}
              hint="Pending orders to confirm"
              icon={icons.clock}
              tone="red"
              href="/seller/orders?status=PENDING"
            />
            <StatCard label="Avg. order value" value={formatCurrency(overview.averageOrderValue)} hint="Last 12 months" icon={icons.money} tone="primary" />
            <StatCard label="Out of stock" value={overview.outOfStock ?? 0} hint="Products at zero stock" icon={icons.warning} tone="amber" href="/seller/products?status=OUT_OF_STOCK" />
            <StatCard label="Lifetime revenue" value={formatCurrency(overview.lifetimeRevenue)} hint="All time, excluding cancellations" icon={icons.store} tone="gray" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <LineChart series={charts.revenue} title="Revenue by month" format="currency" />
            <LineChart series={charts.orders} title="Orders by month" format="number" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <DonutChart data={statusDonut} title="Your orders by status" />
            </div>
            <div className="lg:col-span-2">
              <BarChart series={bestSellersSeries} title="Best sellers by revenue" format="currency" horizontal />
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Latest orders</h2>
                <Link href="/seller/orders" className="text-xs font-medium text-primary hover:underline">
                  View all →
                </Link>
              </div>
              {(stats?.latestOrders || []).length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">No orders yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {stats.latestOrders.map((order) => (
                    <li key={order.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <Link href={`/orders/${order.id}`} className="block truncate text-sm font-medium text-gray-900 hover:text-primary hover:underline">
                          {order.orderNumber}
                        </Link>
                        <span className="block truncate text-xs text-gray-400">
                          {formatDate(order.orderDate)} · {order.customer?.name || "Customer"} · {order.itemCount} item
                          {order.itemCount === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <OrderStatusBadge value={order.status} />
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(order.total)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Restock soon</h2>
                <Link href="/seller/products" className="text-xs font-medium text-primary hover:underline">
                  Manage stock →
                </Link>
              </div>
              {(stats?.lowStock || []).length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">All your products are well stocked.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {stats.lowStock.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={primaryImage(item.images)} alt="" className="h-full w-full object-cover" />
                        </span>
                        <span className="min-w-0">
                          <Link href={`/product/${item.id}`} className="line-clamp-1 block text-sm font-medium text-gray-900 hover:text-primary hover:underline">
                            {item.name}
                          </Link>
                          <span className="block text-xs text-gray-400">{item.sku || item.slug}</span>
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

          {stats?.generatedAt && (
            <p className="mt-4 text-right text-xs text-gray-400">Statistics generated {formatDate(stats.generatedAt)}</p>
          )}
        </>
      )}
    </RoleGate>
  );
}
