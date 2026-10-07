/**
 * /api/seller/stats  — SELLER only.
 *
 * Sales / revenue / order statistics for the signed-in seller's own store:
 *   - headline counts and revenue (lifetime and last 12 months) with deltas
 *   - 12-month revenue / orders / units series for the dashboard charts
 *   - order status distribution
 *   - best-selling and low-stock products
 *   - latest orders
 *
 * Everything is scoped to the session user, so a seller can never see another
 * seller's numbers. This endpoint did not exist before; the README lists
 * "Dashboard: View stats (total products, orders, sales, revenue)" as a seller
 * feature with no backing API.
 *
 * Month bucketing is done in JavaScript so the query is identical on SQLite and
 * PostgreSQL.
 */
import prisma from "@/lib/prisma";
import { respondWithError, methodNotAllowed } from "@/lib/apiError";
import { requireSeller } from "@/lib/auth";
import { ORDER_STATUS, PRODUCT_STATUS } from "@/lib/constants";
import { round2 } from "@/utils/format";
import { serializeOrders } from "@/utils/serialize";

const MONTHS = 12;
const EXCLUDED = [ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED];

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

function toSeries(rows, keys, pick) {
  const buckets = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const row of rows) {
    const key = keyOf(pick.date(row));
    if (key in buckets) buckets[key] += pick.value(row);
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

    const user = await requireSeller(req, res);
    const sellerId = user.id;

    const keys = monthKeys(MONTHS);
    const since = startOfMonthsAgo(MONTHS);
    const prevSince = startOfMonthsAgo(MONTHS * 2);

    const completed = { sellerId, status: { notIn: EXCLUDED } };

    const [
      totalProducts,
      activeProducts,
      inactiveProducts,
      outOfStock,
      lifetimeRevenue,
      lifetimeOrders,
      periodRevenue,
      prevRevenue,
      recentOrders,
      statusGroups,
      bestSellers,
      lowStock,
      latestOrders,
      unitsAgg,
    ] = await Promise.all([
      prisma.product.count({ where: { sellerId } }),
      prisma.product.count({ where: { sellerId, status: PRODUCT_STATUS.ACTIVE } }),
      prisma.product.count({ where: { sellerId, status: PRODUCT_STATUS.INACTIVE } }),
      prisma.product.count({ where: { sellerId, stock: { lte: 0 } } }),

      prisma.order.aggregate({ where: completed, _sum: { total: true, subtotal: true }, _count: { _all: true } }),
      prisma.order.count({ where: { sellerId } }),

      prisma.order.aggregate({ where: { ...completed, orderDate: { gte: since } }, _sum: { total: true }, _count: { _all: true } }),
      prisma.order.aggregate({
        where: { ...completed, orderDate: { gte: prevSince, lt: since } },
        _sum: { total: true },
        _count: { _all: true },
      }),

      prisma.order.findMany({
        where: { sellerId, orderDate: { gte: prevSince } },
        select: { id: true, total: true, orderDate: true, status: true },
      }),

      prisma.order.groupBy({ by: ["status"], where: { sellerId }, _count: { _all: true }, _sum: { total: true } }),

      prisma.orderItem.groupBy({
        by: ["productId"],
        where: { order: completed },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 8,
      }),

      prisma.product.findMany({
        where: { sellerId, stock: { lte: 5 } },
        // `images`/`slug` are needed by the dashboard's restock list, which
        // renders a thumbnail and links through to the product page.
        select: { id: true, name: true, sku: true, slug: true, images: true, stock: true, status: true },
        orderBy: { stock: "asc" },
        take: 10,
      }),

      prisma.order.findMany({
        where: { sellerId },
        orderBy: { orderDate: "desc" },
        take: 8,
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: { select: { id: true, quantity: true } },
        },
      }),

      prisma.orderItem.aggregate({ where: { order: completed }, _sum: { quantity: true } }),
    ]);

    const completedOrders = recentOrders.filter((o) => !EXCLUDED.includes(o.status));

    const revenueSeries = toSeries(
      completedOrders.map((o) => ({ date: o.orderDate, total: o.total })),
      keys,
      { date: (r) => r.date, value: (r) => r.total }
    );
    const ordersSeries = toSeries(
      recentOrders.map((o) => ({ date: o.orderDate })),
      keys,
      { date: (r) => r.date, value: () => 1 }
    );

    const bestIds = bestSellers.map((row) => row.productId);
    const bestProducts = bestIds.length
      ? await prisma.product.findMany({
          where: { id: { in: bestIds }, sellerId },
          select: { id: true, name: true, slug: true, images: true, price: true, stock: true },
        })
      : [];
    const bestById = new Map(bestProducts.map((p) => [p.id, p]));

    const delta = (current, previous) => {
      if (!previous) return current > 0 ? 100 : 0;
      return round2(((current - previous) / previous) * 100);
    };

    const revenue = round2(periodRevenue._sum.total || 0);
    const prevRevenueTotal = round2(prevRevenue._sum.total || 0);
    const periodOrders = periodRevenue._count._all || 0;
    const prevOrders = prevRevenue._count._all || 0;

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      seller: { id: user.id, name: user.name, email: user.email },
      period: { months: MONTHS, since: since.toISOString() },
      overview: {
        products: totalProducts,
        activeProducts,
        inactiveProducts,
        outOfStock,
        orders: lifetimeOrders,
        periodOrders,
        pendingOrders: statusGroups.find((g) => g.status === ORDER_STATUS.PENDING)?._count?._all || 0,
        unitsSold: unitsAgg._sum.quantity || 0,
        revenue,
        lifetimeRevenue: round2(lifetimeRevenue._sum.total || 0),
        averageOrderValue: periodOrders ? round2(revenue / periodOrders) : 0,
      },
      deltas: {
        revenue: delta(revenue, prevRevenueTotal),
        orders: delta(periodOrders, prevOrders),
        previousRevenue: prevRevenueTotal,
        previousOrders: prevOrders,
      },
      charts: {
        revenue: revenueSeries,
        orders: ordersSeries,
        orderStatus: Object.values(ORDER_STATUS).map((status) => {
          const row = statusGroups.find((g) => g.status === status);
          return { status, count: row?._count?._all || 0, revenue: round2(row?._sum?.total || 0) };
        }),
      },
      bestSellers: bestSellers
        .map((row) => {
          const p = bestById.get(row.productId);
          if (!p) return null;
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            images: p.images,
            stock: p.stock,
            price: round2(p.price),
            unitsSold: row._sum.quantity || 0,
            revenue: round2(row._sum.total || 0),
          };
        })
        .filter(Boolean),
      lowStock,
      latestOrders: serializeOrders(latestOrders),
    });
  } catch (error) {
    return respondWithError(res, error, "Failed to load seller statistics.");
  }
}
