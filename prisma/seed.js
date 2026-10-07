"use strict";
/**
 * Database seed.
 *
 *   node prisma/seed.js        (or: npm run db:seed / npx prisma db seed)
 *
 * Runs from the project root against whatever DATABASE_URL points at — local
 * SQLite by default, PostgreSQL/Neon if you set it.
 *
 * Rewritten versus the previous version:
 *   - It no longer requires the removed sql.js fake client at
 *     `src/lib/db.js` via a `path.resolve(__dirname, ...)` hack. It uses the
 *     REAL generated Prisma Client plus the driver adapter from prisma/adapter.js.
 *   - Passwords are bcrypt-hashed (10 rounds) with the same library the
 *     NextAuth credentials provider verifies against, so seeded accounts can
 *     actually log in.
 *   - It is IDEMPOTENT: everything is upserted on its unique key, so running it
 *     twice no longer crashes on "Unique constraint failed".
 *   - No absolute filesystem paths anywhere.
 *
 * Seed accounts (all password: Password123!)
 *   admin@shop.test     ADMIN
 *   seller@shop.test    SELLER
 *   seller2@shop.test   SELLER
 *   customer@shop.test  CUSTOMER
 */
const bcrypt = require("bcryptjs");

const { loadEnv, PROJECT_ROOT } = require("./load-env");
loadEnv();

const { createPrismaAdapter } = require("./adapter");
// Prisma 7 with the `prisma-client-js` generator emits into
// node_modules/@prisma/client, so this resolves the same real client the
// application uses — no fake/mock layer involved.
const { PrismaClient } = require("@prisma/client");

const PASSWORD = "Password123!";
const SALT_ROUNDS = 10;

/** Round to 2dp so seeded money values are clean. */
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const discountPrice = (price, discount) => r2(Number(price) * (1 - Number(discount || 0) / 100));

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { name: "Electronics", slug: "electronics", description: "Phones, audio, computers and smart devices." },
  { name: "Clothing", slug: "clothing", description: "Apparel, footwear and accessories." },
  { name: "Books", slug: "books", description: "Fiction, non-fiction and self-development." },
  { name: "Home & Garden", slug: "home-garden", description: "Everything for the home and outdoor space." },
  { name: "Sports", slug: "sports", description: "Fitness, training and outdoor sports gear." },
];

const BRANDS = [
  { name: "Apple", slug: "apple" },
  { name: "Samsung", slug: "samsung" },
  { name: "Nike", slug: "nike" },
  { name: "Adidas", slug: "adidas" },
  { name: "Penguin", slug: "penguin" },
  { name: "HarperCollins", slug: "harpercollins" },
  { name: "HomeEssentials", slug: "homeessentials" },
];

/** `seller` is resolved to a seeded seller email below. */
const PRODUCTS = [
  {
    name: "iPhone 15 Pro",
    slug: "iphone-15-pro",
    description:
      "The latest iPhone with a titanium design, A17 Pro chip and a pro-grade triple camera system.",
    price: 999.99,
    discount: 10,
    sku: "IPHONE15PRO-001",
    stock: 50,
    category: "electronics",
    brand: "apple",
    seller: "seller@shop.test",
    images: ["/products/iphone-15-pro.svg", "/products/generic-electronics.svg"],
    specifications: { display: '6.1" Super Retina XDR', chip: "A17 Pro", storage: "256GB" },
  },
  {
    name: "Samsung Galaxy S24",
    slug: "samsung-galaxy-s24",
    description: "Flagship Android smartphone with an AI-assisted pro-grade camera and 120Hz display.",
    price: 799.99,
    discount: 0,
    sku: "SGS24-001",
    stock: 75,
    category: "electronics",
    brand: "samsung",
    seller: "seller@shop.test",
    images: ["/products/galaxy-s24.svg", "/products/generic-electronics.svg"],
    specifications: { display: '6.2" Dynamic AMOLED', storage: "128GB" },
  },
  {
    name: "Wireless Earbuds Pro",
    slug: "wireless-earbuds-pro",
    description: "Active noise cancelling earbuds with 30 hours of total battery life.",
    price: 199.99,
    discount: 15,
    sku: "WEP-001",
    stock: 120,
    category: "electronics",
    brand: "apple",
    seller: "seller2@shop.test",
    images: ["/products/generic-electronics.svg"],
  },
  {
    name: "Nike Running Shoes",
    slug: "nike-running-shoes",
    description: "High-performance running shoes built for marathon training and daily miles.",
    price: 129.99,
    discount: 0,
    sku: "NRS-001",
    stock: 100,
    category: "clothing",
    brand: "nike",
    seller: "seller@shop.test",
    images: ["/products/nike-shoes.svg", "/products/generic-clothing.svg"],
    size: ["7", "8", "9", "10", "11"],
    color: ["Black", "Red", "Blue"],
  },
  {
    name: "Adidas T-Shirt",
    slug: "adidas-t-shirt",
    description: "Comfortable cotton Adidas t-shirt with a relaxed fit.",
    price: 29.99,
    discount: 20,
    sku: "ATS-001",
    stock: 200,
    category: "clothing",
    brand: "adidas",
    seller: "seller@shop.test",
    images: ["/products/generic-clothing.svg"],
    size: ["S", "M", "L", "XL"],
    color: ["White", "Black", "Grey"],
  },
  {
    name: "The Great Gatsby",
    slug: "the-great-gatsby",
    description: "F. Scott Fitzgerald's classic novel of Jazz Age excess and the American dream.",
    price: 14.99,
    discount: 0,
    sku: "TGG-001",
    stock: 300,
    category: "books",
    brand: "harpercollins",
    seller: "seller2@shop.test",
    images: ["/products/generic-books.svg"],
    specifications: { pages: 180, format: "Paperback" },
  },
  {
    name: "Atomic Habits",
    slug: "atomic-habits",
    description: "James Clear's practical guide to building good habits and breaking bad ones.",
    price: 19.99,
    discount: 10,
    sku: "AH-001",
    stock: 250,
    category: "books",
    brand: "harpercollins",
    seller: "seller2@shop.test",
    images: ["/products/generic-books.svg"],
    specifications: { pages: 320, format: "Paperback" },
  },
  {
    name: "Smart Garden Kit",
    slug: "smart-garden-kit",
    description: "Automated indoor garden with full-spectrum LED lighting and a self-watering system.",
    price: 149.99,
    discount: 0,
    sku: "SGK-001",
    stock: 25,
    category: "home-garden",
    brand: "homeessentials",
    seller: "seller@shop.test",
    images: ["/products/generic-home.svg"],
  },
  {
    name: "Yoga Mat Pro",
    slug: "yoga-mat-pro",
    description: "Extra-thick non-slip yoga mat with alignment markings and a carry strap.",
    price: 39.99,
    discount: 0,
    sku: "YMP-001",
    stock: 80,
    category: "sports",
    brand: "nike",
    seller: "seller2@shop.test",
    images: ["/products/generic-sports.svg"],
    color: ["Purple", "Teal", "Charcoal"],
  },
  {
    name: "Stainless Steel Water Bottle",
    slug: "stainless-steel-water-bottle",
    description: "Double-walled insulated bottle that keeps drinks cold for 24 hours.",
    price: 24.99,
    discount: 5,
    sku: "SSWB-001",
    stock: 150,
    category: "sports",
    brand: "adidas",
    seller: "seller@shop.test",
    images: ["/products/generic-sports.svg"],
    color: ["Silver", "Matte Black"],
  },
  {
    name: "Sold-Out Demo Headphones",
    slug: "sold-out-demo-headphones",
    description: "Deliberately zero-stock product so you can see the out-of-stock UI states.",
    price: 89.99,
    discount: 0,
    sku: "SODH-001",
    stock: 0,
    category: "electronics",
    brand: "samsung",
    seller: "seller2@shop.test",
    images: ["/products/generic-electronics.svg"],
  },
];

const REVIEWS = [
  { product: "the-great-gatsby", user: "customer@shop.test", rating: 5, comment: "A timeless classic — beautiful prose and a devastating ending." },
  { product: "atomic-habits", user: "customer@shop.test", rating: 4, comment: "Genuinely practical. The 1% improvement framing stuck with me." },
  { product: "iphone-15-pro", user: "customer@shop.test", rating: 5, comment: "Fast, and the titanium body feels much lighter than my old phone." },
  { product: "nike-running-shoes", user: "customer@shop.test", rating: 4, comment: "Comfortable on long runs. Sizing runs slightly small." },
  { product: "adidas-t-shirt", user: "customer@shop.test", rating: 3, comment: "Good cotton but it shrank a little after washing." },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  const { adapter, url, driver } = createPrismaAdapter();
  const prisma = new PrismaClient({ adapter });

  console.log("Seeding database...");
  console.log(`  url:    ${url.startsWith("file:") ? require("path").relative(PROJECT_ROOT, url.replace("file:", "")) || url : url}`);
  if (driver) console.log(`  driver: ${driver}`);

  // Fail early with a helpful message if the schema was never applied.
  try {
    await prisma.user.count();
  } catch (error) {
    throw new Error(
      `The database at ${url} has no tables yet.\n` +
        `  Run "npx prisma db push" first (SQLite/PostgreSQL) and then re-run the seed.\n` +
        `  Original error: ${error.message.split("\n")[0]}`
    );
  }

  const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

  // --- Users ---------------------------------------------------------------
  const users = {};
  const userSpecs = [
    { email: "admin@shop.test", name: "Admin User", role: "ADMIN", phone: "+1 555 0100" },
    { email: "seller@shop.test", name: "Seller One", role: "SELLER", phone: "+1 555 0101" },
    { email: "seller2@shop.test", name: "Seller Two", role: "SELLER", phone: "+1 555 0102" },
    { email: "customer@shop.test", name: "Customer One", role: "CUSTOMER", phone: "+1 555 0103" },
  ];

  for (const spec of userSpecs) {
    users[spec.email] = await prisma.user.upsert({
      where: { email: spec.email },
      update: { name: spec.name, role: spec.role, status: true, phone: spec.phone },
      create: {
        email: spec.email,
        name: spec.name,
        role: spec.role,
        status: true,
        phone: spec.phone,
        // Hashed with bcryptjs — the same algorithm NextAuth verifies against.
        password: passwordHash,
      },
    });
  }
  console.log(`  users:     ${Object.keys(users).length} (admin, 2 sellers, customer)`);

  // A disabled account, so the admin "enable/disable user" flow has something
  // to act on immediately.
  await prisma.user.upsert({
    where: { email: "disabled@shop.test" },
    update: { status: false, role: "CUSTOMER" },
    create: {
      email: "disabled@shop.test",
      name: "Disabled Demo User",
      role: "CUSTOMER",
      status: false,
      password: await bcrypt.hash(PASSWORD, SALT_ROUNDS),
    },
  });

  // --- Categories & brands -------------------------------------------------
  const categories = {};
  for (const c of CATEGORIES) {
    categories[c.slug] = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description },
      create: c,
    });
  }
  console.log(`  categories: ${Object.keys(categories).length}`);

  const brands = {};
  for (const b of BRANDS) {
    brands[b.slug] = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: { name: b.name },
      create: b,
    });
  }
  console.log(`  brands:     ${Object.keys(brands).length}`);

  // --- Products ------------------------------------------------------------
  const products = {};
  for (const p of PRODUCTS) {
    const data = {
      name: p.name,
      description: p.description,
      price: r2(p.price),
      discount: r2(p.discount || 0),
      discountPrice: discountPrice(p.price, p.discount || 0),
      sku: p.sku,
      stock: p.stock,
      images: JSON.stringify(p.images || []),
      size: JSON.stringify(p.size || []),
      color: JSON.stringify(p.color || []),
      specifications: JSON.stringify(p.specifications || {}),
      status: p.stock > 0 ? "ACTIVE" : "OUT_OF_STOCK",
      sellerId: users[p.seller].id,
      categoryId: categories[p.category]?.id ?? null,
      brandId: brands[p.brand]?.id ?? null,
    };

    products[p.slug] = await prisma.product.upsert({
      where: { slug: p.slug },
      update: data,
      create: { slug: p.slug, ...data },
    });
  }
  console.log(`  products:   ${Object.keys(products).length} (split across both sellers)`);

  // --- Customer address ----------------------------------------------------
  await prisma.address.upsert({
    where: { id: "seed-address-customer-home" },
    update: {},
    create: {
      id: "seed-address-customer-home",
      userId: users["customer@shop.test"].id,
      type: "SHIPPING",
      label: "Home",
      fullName: "Customer One",
      phone: "+1 555 0103",
      line1: "123 Main St",
      line2: "Apt 4B",
      city: "Springfield",
      state: "IL",
      postalCode: "62704",
      country: "United States",
      isDefault: true,
    },
  }).catch(async () => {
    // `id` is not a unique-input on its own in every Prisma version; fall back
    // to a find/create keyed on the user.
    const existing = await prisma.address.findFirst({
      where: { userId: users["customer@shop.test"].id, label: "Home" },
    });
    if (!existing) {
      await prisma.address.create({
        data: {
          userId: users["customer@shop.test"].id,
          type: "SHIPPING",
          label: "Home",
          fullName: "Customer One",
          phone: "+1 555 0103",
          line1: "123 Main St",
          line2: "Apt 4B",
          city: "Springfield",
          state: "IL",
          postalCode: "62704",
          country: "United States",
          isDefault: true,
        },
      });
    }
  });

  // --- Cart & wishlist -----------------------------------------------------
  const cart = await prisma.cart.upsert({
    where: { userId: users["customer@shop.test"].id },
    update: {},
    create: { userId: users["customer@shop.test"].id },
  });

  const cartLines = [
    { slug: "nike-running-shoes", quantity: 1 },
    { slug: "atomic-habits", quantity: 2 },
  ];
  for (const line of cartLines) {
    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: products[line.slug].id } },
      update: { quantity: line.quantity },
      create: { cartId: cart.id, productId: products[line.slug].id, quantity: line.quantity },
    });
  }

  const wishlist = await prisma.wishlist.upsert({
    where: { userId: users["customer@shop.test"].id },
    update: {},
    create: { userId: users["customer@shop.test"].id },
  });
  for (const slug of ["iphone-15-pro", "smart-garden-kit"]) {
    await prisma.wishlistItem.upsert({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId: products[slug].id } },
      update: {},
      create: { wishlistId: wishlist.id, productId: products[slug].id },
    });
  }
  console.log(`  cart:       ${cartLines.length} item(s) | wishlist: 2 item(s)`);

  // --- Reviews -------------------------------------------------------------
  let reviewCount = 0;
  for (const r of REVIEWS) {
    const product = products[r.product];
    if (!product) continue;
    await prisma.review.upsert({
      where: { userId_productId: { userId: users[r.user].id, productId: product.id } },
      update: { rating: r.rating, comment: r.comment },
      create: { userId: users[r.user].id, productId: product.id, rating: r.rating, comment: r.comment },
    });
    reviewCount += 1;
  }

  // Keep the denormalised rating columns in sync.
  for (const slug of Object.keys(products)) {
    const agg = await prisma.review.aggregate({
      where: { productId: products[slug].id },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await prisma.product.update({
      where: { id: products[slug].id },
      data: {
        averageRating: r2(agg._avg.rating || 0),
        reviewCount: agg._count.rating || 0,
        views: products[slug].views || Math.floor(Math.random() * 200) + 10,
      },
    });
  }
  console.log(`  reviews:    ${reviewCount}`);

  // --- Sample orders (one per seller, exercising the status pipeline) ------
  const orderSpecs = [
    {
      orderNumber: "ORD-SEED-0001",
      seller: "seller@shop.test",
      status: "DELIVERED",
      paymentStatus: "PAID",
      paymentMethod: "MOCK",
      daysAgo: 21,
      lines: [{ slug: "iphone-15-pro", quantity: 1 }],
    },
    {
      orderNumber: "ORD-SEED-0002",
      seller: "seller2@shop.test",
      status: "SHIPPED",
      paymentStatus: "PAID",
      paymentMethod: "MOCK",
      daysAgo: 6,
      trackingNumber: "TRACK-SEED-0002",
      lines: [{ slug: "the-great-gatsby", quantity: 2 }, { slug: "wireless-earbuds-pro", quantity: 1 }],
    },
    {
      orderNumber: "ORD-SEED-0003",
      seller: "seller@shop.test",
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod: "COD",
      daysAgo: 1,
      lines: [{ slug: "adidas-t-shirt", quantity: 3 }],
    },
    {
      orderNumber: "ORD-SEED-0004",
      seller: "seller2@shop.test",
      status: "CANCELLED",
      paymentStatus: "REFUNDED",
      paymentMethod: "MOCK",
      daysAgo: 34,
      lines: [{ slug: "yoga-mat-pro", quantity: 1 }],
    },
  ];

  const SHIPPING_FEE = Number(process.env.SHIPPING_FEE ?? 5.99);
  const TAX_RATE = Number(process.env.TAX_RATE ?? 0.1);
  const addressSnapshot = "Customer One | +1 555 0103 | 123 Main St | Apt 4B | Springfield, IL, 62704 | United States";

  let ordersCreated = 0;
  for (const spec of orderSpecs) {
    const orderDate = new Date(Date.now() - spec.daysAgo * 24 * 60 * 60 * 1000);

    const lines = spec.lines.map((line) => {
      const product = products[line.slug];
      const unit = discountPrice(product.price, product.discount);
      return { productId: product.id, quantity: line.quantity, price: unit, total: r2(unit * line.quantity) };
    });

    const subtotal = r2(lines.reduce((sum, l) => sum + l.total, 0));
    const shipping = spec.status === "CANCELLED" ? 0 : r2(SHIPPING_FEE);
    const tax = r2(subtotal * TAX_RATE);
    const total = r2(subtotal + shipping + tax);

    await prisma.order.upsert({
      where: { orderNumber: spec.orderNumber },
      update: { status: spec.status, paymentStatus: spec.paymentStatus },
      create: {
        orderNumber: spec.orderNumber,
        status: spec.status,
        paymentStatus: spec.paymentStatus,
        paymentMethod: spec.paymentMethod,
        subtotal,
        discount: 0,
        shipping,
        tax,
        total,
        shippingAddress: addressSnapshot,
        trackingNumber: spec.trackingNumber || null,
        orderDate,
        cancelledAt: spec.status === "CANCELLED" ? new Date(orderDate.getTime() + 86400000) : null,
        userId: users["customer@shop.test"].id,
        sellerId: users[spec.seller].id,
        items: { create: lines },
        events: {
          create: buildSeedTimeline(spec, orderDate, users["customer@shop.test"].id),
        },
      },
    });
    ordersCreated += 1;
  }
  console.log(`  orders:     ${ordersCreated} (delivered / shipped / pending / cancelled)`);

  const totals = await prisma.order.aggregate({ _sum: { total: true }, _count: { _all: true } });
  console.log("");
  console.log("Seed complete.");
  console.log(`  ${totals._count._all} order(s), revenue ${r2(totals._sum.total || 0).toFixed(2)}`);
  console.log("");
  console.log("Sign in with any of these (password: " + PASSWORD + "):");
  console.log("  ADMIN    admin@shop.test");
  console.log("  SELLER   seller@shop.test");
  console.log("  SELLER   seller2@shop.test");
  console.log("  CUSTOMER customer@shop.test");

  await prisma.$disconnect();
}

/** Build a plausible OrderEvent timeline for a seeded order. */
function buildSeedTimeline(spec, orderDate, actorId) {
  const day = 24 * 60 * 60 * 1000;
  const events = [{ status: "PENDING", note: "Order placed.", createdAt: new Date(orderDate), actorId }];

  if (spec.status === "CANCELLED") {
    events.push({
      status: "CANCELLED",
      note: "Cancelled by customer. Stock restored.",
      createdAt: new Date(orderDate.getTime() + day),
      actorId,
    });
    return events;
  }

  events.push({ status: "CONFIRMED", note: "Order confirmed by the seller.", createdAt: new Date(orderDate.getTime() + day * 0.4), actorId });

  if (["PROCESSING", "SHIPPED", "DELIVERED"].includes(spec.status)) {
    events.push({ status: "PROCESSING", note: "Order is being prepared for dispatch.", createdAt: new Date(orderDate.getTime() + day), actorId });
  }
  if (["SHIPPED", "DELIVERED"].includes(spec.status)) {
    events.push({
      status: "SHIPPED",
      note: spec.trackingNumber ? `Shipped. Tracking number ${spec.trackingNumber}.` : "Order has been shipped.",
      createdAt: new Date(orderDate.getTime() + day * 2),
      actorId,
    });
  }
  if (spec.status === "DELIVERED") {
    events.push({ status: "DELIVERED", note: "Order delivered.", createdAt: new Date(orderDate.getTime() + day * 5), actorId });
  }
  return events;
}

main().catch(async (error) => {
  console.error("");
  console.error("Seed failed:", error.message || error);
  if (error.hint) console.error("Hint:", error.hint);
  process.exitCode = 1;
});
