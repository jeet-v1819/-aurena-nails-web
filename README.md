# Multi-Vendor E-Commerce Platform

A complete, professional multi-vendor E-commerce website built with Next.js, React, Node.js, PostgreSQL (via Prisma), and Tailwind CSS.

## Overview

This is a fully functional E-commerce platform supporting three roles:
- **Admin** - Full administrative access
- **Seller** - Product and order management
- **Customer** - Shopping, cart, wishlist, reviews

## Features

### Customer Features
- **Product Browsing**: View, search, filter, and sort products
- **Wishlist**: Add/remove products, move to cart
- **Cart**: Add/remove items, update quantities, calculate subtotal, discount, shipping, tax
- **Checkout**: Shipping information, payment processing, order confirmation
- **Orders**: View order history, track order status, cancel orders
- **Product Reviews**: Submit reviews, view average ratings
- **User Profile**: Manage personal information

### Seller Features
- **Product Management**: Add, edit, delete, enable/disable products
- **Order Management**: View orders, update order status, mark as shipped/delivered
- **Dashboard**: View stats (total products, orders, sales, revenue)
- **Product Dashboard**: View own products only

### Admin Features
- **User Management**: View all users, search/filter, change roles, enable/disable
- **Seller Management**: View all sellers, enable/disable, delete
- **Product Management**: View all products, add/edit/delete, enable/disable, update stock
- **Order Management**: View all orders, search/filter, update status, delete
- **Dashboard Statistics**: Total users, customers, sellers, products, orders, revenue
- **Charts**: Sales, revenue, orders, users, products

## Technology Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4
- **Backend**: Next.js API Routes, Node.js
- **Database**: PostgreSQL (via Prisma ORM) - SQLite for development
- **ORM**: Prisma 7
- **Authentication**: Next-auth

## Project Structure

```
ecommerce-platform/
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── seed.js             # Seed data
│   └── migrations/         # Database migrations
├── src/
│   ├── app/                # Next.js 13+ App Router
│   │   ├── product/[id]/   # Product detail pages
│   │   ├── products/       # Products listing page
│   │   ├── cart/           # Shopping cart page
│   │   ├── checkout/       # Checkout page
│   │   ├── profile/        # User profile page
│   │   ├── login/          # Login page
│   │   ├── register/       # Registration page
│   │   ├── seller/         # Seller dashboard
│   │   ├── admin/          # Admin dashboard
│   │   ├── layout.js       # Root layout
│   │   └── page.js         # Home page
│   ├── pages/api/          # API Routes
│   │   ├── auth/[...nextauth]  # Authentication
│   │   ├── products.js       # Product CRUD
│   │   ├── categories.js     # Categories
│   │   ├── brands.js         # Brands
│   │   ├── cart.js           # Cart management
│   │   ├── orders.js         # Order management
│   │   ├── wishlist.js       # Wishlist management
│   │   ├── admin/
│   │   │   ├── users.js      # User management
│   │   │   ├── sellers.js    # Seller management
│   │   │   ├── products.js   # Admin product management
│   │   │   └── orders.js     # Admin order management
│   │   └── seller/
│   │       ├── products.js   # Seller product management
│       └── orders.js         # Seller order management
│   ├── lib/
│   │   └── prisma.js         # Prisma client instance
│   ├── services/           # Business logic services
│   │   ├── productService.js
│   │   ├── cartService.js
│   │   ├── wishlistService.js
│   │   └── orderService.js
│   ├── components/         # React UI Components
│   │   ├── header.js         # Site header
│   │   ├── navigation.js     # Navigation menu
│   │   ├── products/         # Product grid/components
│   │   ├── cart/             # Cart-related components
│   │   ├── dashboard/        # Dashboard components
│   │   └── footer/           # Site footer
│   └── utils/              # Utility functions
├── package.json
├── tailwind.config.mjs
├── postcss.config.mjs
├── next-config.js
├── jsconfig.json           # Path aliases (@/*)
└── .env                    # Environment variables
```

## Prerequisites

- **Node.js >= 20** (developed and verified on Node 22; Next.js 16 requires >= 20.9)
- npm (a committed `package-lock.json` keeps installs reproducible)
- **No database server needed for local development** — SQLite is used by default
- PostgreSQL (or Neon) only for production

## Setup Instructions

Four commands from a clean clone. All of them work on Windows, macOS and Linux.

### 1. Clone the repository
```bash
git clone <repository-url>
cd <project-directory>
```

### 2. Configure the environment
```bash
cp .env.example .env        # macOS / Linux
copy .env.example .env      # Windows
```

`.env.example` already contains working local defaults; the only value you must
replace is `NEXTAUTH_SECRET`. Generate one with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

For local development keep:
```
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="<generated above>"
NEXTAUTH_URL="http://localhost:3000"
```

> **Do not set `AUTH_TRUST_HOST` locally.** next-auth v4 derives its callback
> origin from `NEXTAUTH_URL` when present; `AUTH_TRUST_HOST` is for deployments
> behind a proxy (see [Netlify deployment](#netlify-deployment)) where no proxy
> headers exist locally and trusting the host would yield `https://localhost`.

### 3. Install dependencies
```bash
npm install
```
`postinstall` runs `prisma generate`, so the Prisma Client exists before you
start the server.

### 4. Create and seed the database
```bash
npm run db:setup          # = prisma db push  +  node prisma/seed.js
```
This creates `prisma/dev.db` and fills it with the demo catalogue, the four seed
accounts, sample orders, reviews and a customer cart/wishlist. The seed is
**idempotent** — re-running it updates existing rows instead of duplicating them.

Equivalent individual commands:
```bash
npm run db:push           # apply prisma/schema.prisma to the database
npm run db:seed           # node prisma/seed.js
```

### 5. Run the app
```bash
npm run dev               # development server  -> http://localhost:3000
npm run build             # production build (next build --webpack)
npm run start             # serve the production build
```

### Available scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `next dev` | Development server |
| `build` | `next build --webpack` | Production build |
| `start` | `next start` | Serve the production build |
| `lint` | `next lint` | ESLint |
| `postinstall` | `prisma generate` | Generate the Prisma Client after `npm install` |
| `db:push` | `prisma db push` | Apply the schema (no migration history) |
| `db:seed` | `node prisma/seed.js` | Load demo data (idempotent) |
| `db:setup` | `prisma db push && node prisma/seed.js` | Push + seed in one step |
| `db:reset` | `prisma db push --force-reset && node prisma/seed.js` | Wipe and reseed |
| `db:studio` | `prisma studio` | Browse the database |
| `db:generate` | `prisma generate` | Regenerate the client |
| `db:pull` | `prisma db pull` | Introspect an existing database |
| `schema:pg` | `node prisma/build-postgres-schema.js` | Emit a PostgreSQL variant of the schema |

## Netlify deployment

`netlify.toml` is committed and needs no changes. Netlify runs `npm run build`
and `@netlify/plugin-nextjs` handles the Next.js runtime.

Set these environment variables in **Site configuration → Environment variables**:

| Variable | Value | Required |
| --- | --- | --- |
| `DATABASE_URL` | Neon/PostgreSQL connection string, e.g. `postgresql://user:pass@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require` | Yes |
| `NEXTAUTH_SECRET` | 32-byte random base64 secret | Yes |
| `AUTH_TRUST_HOST` | `true` | Yes |
| `NEXTAUTH_URL` | *leave unset* | No |
| `NEXT_PUBLIC_DEMO_ACCOUNTS` | `false` (hides the demo-login panel) | Recommended |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | only if you want social login | No |
| `SHIPPING_FEE`, `TAX_RATE`, `FREE_SHIPPING_THRESHOLD` | commerce tuning, defaults built in | No |

Why `AUTH_TRUST_HOST` instead of `NEXTAUTH_URL`: Netlify gives every deploy
preview its own hostname. Trusting the forwarded host means sign-in redirects and
session cookies are correct on the production URL *and* on every preview URL,
with nothing to update per deploy. Set `NEXTAUTH_URL` only if you serve the app
from one fixed absolute URL.

**Create the production tables before the first deploy.** Netlify's build
environment is ephemeral, so run this once from your machine with the production
`DATABASE_URL` in `.env`:
```bash
npm run db:push
npm run db:seed      # optional: demo data in production
```

> **Payments are simulated.** No payment gateway is configured or implied. The
> checkout page and the API both label this explicitly
> (`payment.simulated: true`); `MOCK`/`CARD`/`UPI` are recorded as labels and
> `COD` leaves the order unpaid. Do not describe this as real payment processing.

## Default Seed Accounts

### Admin
- **Email**: admin@shop.test
- **Password**: Password123!
- **Role**: ADMIN

### Seller 1
- **Email**: seller@shop.test
- **Password**: Password123!
- **Role**: SELLER

### Seller 2
- **Email**: seller2@shop.test
- **Password**: Password123!
- **Role**: SELLER

### Customer
- **Email**: customer@shop.test
- **Password**: Password123!
- **Role**: CUSTOMER

## Database Schema

The Prisma schema defines the following models:

- **User**: Users with role-based access (ADMIN, SELLER, CUSTOMER)
- **Category**: Product categories (Electronics, Clothing, Books, etc.)
- **Brand**: Product brands (Apple, Samsung, Nike, etc.)
- **Product**: Products with pricing, stock, ratings, and relationships
- **Cart**: Customer shopping carts
- **CartItem**: Individual items in the cart
- **Wishlist**: Customer wishlists
- **WishlistItem**: Items in the wishlist
- **Order**: Customer orders
- **OrderItem**: Individual items in orders
- **Review**: Product reviews with ratings
- **Address**: Shipping/billing addresses

## Key API Endpoints

### Authentication
- `GET/POST /api/auth/[...nextauth]` - Login/Logout
- `GET /api/auth/signin` - Sign in page
- `GET /api/auth/signup` - Register page

### Products
- `GET /api/products` - List products with filters
- `GET /api/products/[id]` - Get product details
- `POST /api/cart` - Add to cart
- `DELETE /api/cart/remove/[id]` - Remove from cart
- `PUT /api/cart/quantity/[id]` - Update cart quantity

### Cart
- `GET /api/cart` - Get cart contents
- `POST /api/cart` - Add item
- `DELETE /api/cart/remove/[id]` - Remove item
- `PUT /api/cart/quantity/[id]` - Update quantity

### Wishlist
- `GET /api/wishlist` - Get wishlist
- `POST /api/wishlist` - Add item
- `DELETE /api/wishlist/remove/[id]` - Remove item

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders` - List orders
- `GET /api/orders/[id]` - Get order details
- `PUT /api/orders/[id]/status` - Update order status

### Admin
- `GET /api/admin/users` - List users
- `GET /api/admin/sellers` - List sellers
- `GET /api/admin/products` - List products
- `GET /api/admin/orders` - List orders
- `PUT /api/admin/users/[id]/role` - Change user role
- `DELETE /api/admin/users/[id]` - Delete user

### Seller
- `GET /api/seller/products` - List seller's products
- `GET /api/seller/orders` - List seller's orders
- `PUT /api/seller/orders/[id]/status` - Update order status

## Features Implementation Status

### ✅ Completed
- Project structure setup
- Prisma database schema with all models (13 models, SQLite **and** PostgreSQL compatible)
- SQLite database setup and seed data (`npm run db:setup`)
- Authentication (NextAuth v4 credentials provider, bcrypt-hashed passwords, JWT sessions)
- Server-side role enforcement on **every** `/api/admin/*` and `/api/seller/*` route
- URL guarding via `src/proxy.js` (the Next.js 16 replacement for `middleware.js`)
- Product listing with search, filter, sort and pagination
- Product details page (gallery, variants, specifications, reviews, related products)
- Shopping cart (add / remove / update quantity / clear, server-computed totals)
- Wishlist (add / remove / toggle / move to cart / clear)
- Checkout with shipping address, saved addresses and order confirmation
- **Multi-vendor checkout** — a cart spanning several sellers is split into one
  order per seller inside a single transaction, with guarded stock decrements
- Order history, per-order tracking timeline and customer cancellation (restocks)
- Seller order fulfilment workflow with an enforced status transition map
- Product reviews with rating histograms and one-review-per-customer updates
- User profile: details, password change and address book CRUD
- Admin console: dashboard, users, sellers, products, orders
- Seller console: dashboard, products, orders
- Dashboard statistics with hand-rolled SVG charts (no charting dependency)
- Responsive design (mobile, tablet, desktop)
- Tailwind CSS 4 styling with theme tokens
- Empty states, error states, loading states, validation messages,
  confirmation dialogs and toast notifications

### ⚠️ Known limitations (by design, not unfinished work)
- **Payment processing is simulated.** No gateway is integrated and none is
  implied — the checkout UI and the API response both say so
  (`payment.simulated: true`). Integrating Stripe/Razorpay is a separate task.
- Email verification and transactional email are not implemented; status changes
  are recorded on the order timeline instead.
- Social login (Google) is implemented but only activates when both
  `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
- `prisma db push` is used rather than a migration history, because the two
  committed `migration.sql` files were empty (0 bytes). Generate real migrations
  with `prisma migrate dev` before relying on `migrate deploy` in production.
- `@prisma/adapter-better-sqlite3` is an **optional** dependency. Where its
  native addon cannot be compiled (restricted CI, some Windows toolchains), the
  pure-JS `@prisma/adapter-libsql` is used automatically — same SQLite file, no
  code changes. webpack's "module not found" warning for it is intentionally
  suppressed in `next.config.js`.

## Development Notes

### JavaScript only
The project is JavaScript end to end — no TypeScript, no `tsconfig.json`, no
`@types/*` packages. Path aliases are configured in `jsconfig.json`
(`@/* -> ./src/*`); the `baseUrl` entry there is required for the alias to
resolve at build time.

### Database portability
The same `prisma/schema.prisma` runs on SQLite (local) and PostgreSQL/Neon
(production). To stay portable the schema deliberately avoids:
- **enums** — SQLite has none, so statuses are `String` columns validated against
  `src/lib/constants.js`
- **Json columns** — `images`, `size`, `color` and `specifications` are stored as
  JSON-encoded strings and parsed by `src/utils/format.js`
- case-insensitive `mode: "insensitive"` filters — `src/utils/query.js` adds them
  only when the provider is PostgreSQL (SQLite's `LIKE` is already
  case-insensitive for ASCII)

Prisma 7 removed the bundled query engine, so `PrismaClient` requires a driver
adapter. `prisma/adapter.js` picks one from `DATABASE_URL`
(`postgres*` → `@prisma/adapter-pg`, `libsql://`/`http(s)://` → libSQL,
`file:` → better-sqlite3 with a libSQL fallback) and is shared by the Next.js
runtime *and* plain Node scripts such as `prisma/seed.js`.

### Adding new features
1. Add the API route in `src/pages/api/`
2. Add the business logic in `src/services/` (never call Prisma from a page)
3. Create the page in `src/app/` as a Client Component that calls the API
4. Add shared UI in `src/components/`
5. Update `prisma/schema.prisma` if the data model changes
6. Run `npm run db:push` then `npm run db:seed`
7. Run `npm run build` to verify

App Router pages are Client Components on purpose: no page imports Prisma, so
`next build` never needs a reachable database. Header and footer are rendered
once by `src/app/layout.js` — do not re-add them inside a page.

## License

This project is for demonstration purposes. See the LICENSE file for more details.