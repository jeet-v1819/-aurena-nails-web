/**
 * /api/admin/stats  — ADMIN only.
 *
 * Everything the admin dashboard needs in one request:
 *   - headline counts (users, customers, sellers, products, orders, revenue)
 *   - deltas versus the previous period
 *   - 12-month series for the revenue / orders / users / products charts
 *   - order status distribution, top sellers, top products, category split
 *   - low-stock alerts
 *
 * This endpoint did not exist before; the admin dashboard and its charts were
 * listed in the README but had no backing API.
 *
 * Portability note: month bucketing is done in JavaScript rather than with
 * date_trunc()/strftime(), because the query must run unchanged on SQLite
 * (local) and PostgreSQL (production).
 */
import prisma from "@/lib/prisma";
import { respondWithError, methodNotAllowed } from "@/lib/apiError";
import { requireAdmin } from "@/lib/auth";
import { ORDER_STATUS, ROLES } from "@/lib/constants";
import { round2 } from "@/utils/format";
import { serializeOrders } from "@/utils/serialize";

const MONTHS = 12;

/** Last N month keys, oldest first: ["2025-11", ..., "2026-10"]. */
function monthKeys(count = MONTHS) {
  const keys = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

const keyOf = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

function startOfMonthsAgo(count) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1), 1));
}

/** Build a dense {labels, values} series with zero-filled months. */
function toSeries(rows, keys, valueFn) {
  const buckets = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const row of rows) {
    const key = keyOf(row.date);
    if (key in buckets) buckets[key] += valueFn(row);
  }
  return {
    labels: keys.map((k) => {
      const [year, month] = k.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    }),
    keys,
    values: keys.map((k) => round2(buckets[k])),
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
    await requireAdmin(req, res);

    const keys = monthKeys(MONTHS);
    const since = startOfMonthsAgo(MONTHS);
    // The previous window, for period-over-period deltas.
    const prevSince = startOfMonthsAgo(MONTHS * 2);

    const [
      totalUsers,
      totalCustomers,
      totalSellers,
      activeSellers,
      disabledUsers,
      totalProducts,
      activeProducts,
      outOfStockProducts,
      totalOrders,
      pendingOrders,
      cancelledOrders,
      revenueAgg,
      revenueAggPrev,
      recentOrders,
      recentUsers,
      statusGroups,
      topSellers,
      topProducts,
      categoryGroups,
      lowStock,
      latestOrders,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: ROLES.CUSTOMER } }),
      prisma.user.count({ where: { role: ROLES.SELLER } }),
      prisma.user.count({ where: { role: ROLES.SELLER, status: true } }),
      prisma.user.count({ where: { status: false } }),
      prisma.product.count(),
      prisma.product.count({ where: { status: "ACTIVE" } }),
      prisma.product.count({ where: { stock: { lte: 0 } } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: ORDER_STATUS.PENDING } }),
      prisma.order.count({ where: { status: ORDER_STATUS.CANCELLED } }),

      prisma.order.aggregate({
        where: { status: { notIn: [ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED] }, orderDate: { gte: since } },
        _sum: { total: true, subtotal: true, tax: true, shipping: true },
        _count: { _all: true },
      }),
      prisma.order.aggregate({
        where: {
          status: { notIn: [ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED] },
          orderDate: { gte: prevSince, lt: since },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),

      prisma.order.findMany({
        where: { orderDate: { gte: prevSince } },
        select: { id: true, total: true, orderDate: true, status: true },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: prevSince } },
        select: { id: true, createdAt: true, role: true },
      }),

      prisma.order.groupBy({ by: ["status"], _count: { _all: true }, _sum: { total: true } }),

      prisma.user.findMany({
        where: { role: ROLES.SELLER },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          _count: { select: { products: true } },
        },
        take: 50,
      }),
      prisma.orderItem.groupBy({
        by: ["productId"],
        where: { order: { status: { notIn: [ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED] } } },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 8,
      }),
      prisma.category.findMany({
        select: { id: true, name: true, slug: true, _count: { select: { products: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.product.findMany({
        where: { stock: { lte: 5 }, status: { not: "INACTIVE" } },
        select: { id: true, name: true, sku: true, stock: true, status: true, seller: { select: { id: true, name: true } } },
        orderBy: { stock: "asc" },
        take: 10,
      }),
      // "Latest orders" table on the dashboard.
      prisma.order.findMany({
        orderBy: { orderDate: "desc" },
        take: 8,
        include: {
          user: { select: { id: true, name: true, email: true } },
          seller: { select: { id: true, name: true } },
          items: { select: { id: true, quantity: true } },
        },
      }),
    ]);

    // --- 12-month chart series -------------------------------------------
    const completedOrders = recentOrders.filter(
      (o) => o.status !== ORDER_STATUS.CANCELLED && o.status !== ORDER_STATUS.REFUNDED
    );

    const revenueSeries = toSeries(
      completedOrders.map((o) => ({ date: o.orderDate, value: o.total })),
      keys,
      (row) => row.value
    );
    const ordersSeries = toSeries(
      recentOrders.map((o) => ({ date: o.orderDate, value: 1 })),
      keys,
      (row) => row.value
    );
    const usersSeries = toSeries(
      recentUsers.map((u) => ({ date: u.createdAt, value: 1 })),
      keys,
      (row) => row.value
    );
    const productsSeries = {
      labels: categoryGroups.map((c) => c.name),
      values: categoryGroups.map((c) => c._count.products),
      keys: categoryGroups.map((c) => c.slug),
    };

    // --- Top sellers (revenue computed from their orders) ------------------
    const revenueBySeller = new Map();
    const sellerRevenue = await prisma.order.groupBy({
      by: ["sellerId"],
      where: { status: { notIn: [ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED] } },
      _sum: { total: true },
      _count: { _all: true },
    });
    for (const row of sellerRevenue) revenueBySeller.set(row.sellerId, row);

    const sellers = topSellers
      .map((seller) => ({
        id: seller.id,
        name: seller.name,
        email: seller.email,
        status: seller.status,
        products: seller._count.products,
        orders: revenueBySeller.get(seller.id)?._count?._all || 0,
        revenue: round2(revenueBySeller.get(seller.id)?._sum?.total || 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // --- Top products ------------------------------------------------------
    const productIds = topProducts.map((row) => row.productId);
    const productRows = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, slug: true, images: true, price: true, stock: true, seller: { select: { name: true } } },
        })
      : [];
    const productById = new Map(productRows.map((p) => [p.id, p]));

    const products = topProducts
      .map((row) => {
        const p = productById.get(row.productId);
        return {
          id: row.productId,
          name: p?.name || "Removed product",
          slug: p?.slug || null,
          images: p?.images || "[]",
          stock: p?.stock ?? 0,
          sellerName: p?.seller?.name || null,
          unitsSold: row._sum.quantity || 0,
          revenue: round2(row._sum.total || 0),
        };
      })
      .filter((row) => row.name !== "Removed product");

    const revenue = round2(revenueAgg._sum.total || 0);
    const prevRevenue = round2(revenueAggPrev._sum.total || 0);
    const prevOrders = revenueAggPrev._count._all || 0;
    const currentOrders = revenueAgg._count._all || 0;

    const delta = (current, previous) => {
      if (!previous) return current > 0 ? 100 : 0;
      return round2(((current - previous) / previous) * 100);
    };

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      period: { months: MONTHS, since: since.toISOString() },
      overview: {
        users: totalUsers,
        customers: totalCustomers,
        sellers: totalSellers,
        activeSellers,
        disabledUsers,
        products: totalProducts,
        activeProducts,
        outOfStockProducts,
        orders: totalOrders,
        pendingOrders,
        cancelledOrders,
        revenue,
        averageOrderValue: currentOrders ? round2(revenue / currentOrders) : 0,
      },
      deltas: {
        revenue: delta(revenue, prevRevenue),
        orders: delta(currentOrders, prevOrders),
        previousRevenue: prevRevenue,
        previousOrders: prevOrders,
      },
      charts: {
        revenue: revenueSeries,
        orders: ordersSeries,
        users: usersSeries,
        products: productsSeries,
        orderStatus: Object.values(ORDER_STATUS).map((status) => {
          const row = statusGroups.find((g) => g.status === status);
          return { status, count: row?._count?._all || 0, revenue: round2(row?._sum?.total || 0) };
        }),
      },
      sellers,
      products,
      lowStock,
      latestOrders: serializeOrders(latestOrders),
    });
  } catch (error) {
    return respondWithError(res, error, "Failed to load admin statistics.");
  }
}
