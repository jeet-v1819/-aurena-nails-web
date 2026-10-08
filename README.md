# Aurena Nails — Luxury Nail Art & Beauty Studio

A complete, production-ready website and studio-management system for **Aurena Nails**, a luxury nail-art
studio. Customers browse services, look through the gallery of nail designs, watch studio videos, book
appointments in a five-step wizard, save designs to a wishlist, and leave reviews after a visit. The studio
owner manages everything — services, gallery, videos, appointments, customers, reviews, messages, opening
hours, holidays and website copy — from a protected admin panel.

> **This is not an e-commerce site.** There is no cart, no checkout, no orders, no shipping, no inventory,
> no coupons and no payment gateway anywhere in the codebase. Prices are shown for information only; every
> commercial action ends in a conversation or an appointment. The word used throughout the customer-facing
> app is **service**, never "product".

---

## Table of contents

- [Feature overview](#feature-overview)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
  - [Option A — local PostgreSQL (no account needed)](#option-a--local-postgresql-no-account-needed)
  - [Option B — Neon (production database)](#option-b--neon-production-database)
- [Migrations](#migrations)
- [Seeding the database](#seeding-the-database)
- [Cloudinary setup](#cloudinary-setup)
- [Email setup](#email-setup)
- [Admin setup](#admin-setup)
- [Running the app](#running-the-app)
- [Deploying to production](#deploying-to-production)
- [Route reference](#route-reference)
- [Project structure](#project-structure)
- [How the app is built](#how-the-app-is-built)
- [Database schema notes](#database-schema-notes)
- [Available scripts](#available-scripts)
- [Troubleshooting](#troubleshooting)

---

## Feature overview

### Public site

| Area | What it does |
| --- | --- |
| **Home** | Editorial hero, featured services, studio story, gallery preview, customer testimonials, opening hours, floating WhatsApp button |
| **Services** `/services` | Search, category / style / occasion / nail-type filters, sorting, pagination, rating badges |
| **Service detail** `/services/[slug]` | Photo & video gallery, duration, information-only pricing, preparation and after-care instructions, related services, reviews, "Book this service" and wishlist buttons |
| **Gallery** `/gallery` | Masonry layout of real studio work, tag / category / style filters, pagination, full-screen lightbox, wishlist saving |
| **Gallery design** `/gallery/[id]` | Single design with tags, related designs, wishlist button |
| **Videos** `/videos` | Studio video library with thumbnails and duration; detail pages play the video inline |
| **About** `/about` | Story, mission, artist profile, live studio statistics, opening hours |
| **Booking** `/booking` | Five-step wizard: **service → date → time → note → confirm**, with live availability |
| **Contact** `/contact` | Contact form (stored in the database), studio details, opening hours, social links, WhatsApp |
| **Global search** `/search` | Searches services, gallery designs and videos in one query |
| **Auth** | Register, email-**or**-mobile sign-in, show/hide password, forgot / reset password |

### Booking rules (all server-enforced)

- Slots come from the studio's real **business hours**, per weekday, with optional break windows.
- **Holidays** and past dates are blocked; bookings beyond the maximum advance window are refused.
- A **minimum lead time** and a **buffer** between appointments are enforced.
- **Double booking is impossible**: a partial unique index in PostgreSQL
  (`Appointment_active_slot_key`) makes two active appointments at the same date and time a database error,
  and the UI reports it politely ("_That time slot was just taken…_"). Availability already subtracts
  booked slots, so the disabled slot never appears in the first place.
- Statuses: `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `REJECTED`, with a strict transition table.
- Customers can cancel from their dashboard while the cancellation window is open.

### Customer area

`/profile` (edit details, change password, avatar), `/appointments` (upcoming & past, cancel, write a
review), `/wishlist` (saved services **and** gallery designs), `/notifications` (read / unread, mark all,
delete). Inactive accounts are blocked at sign-in with _"Your account is currently inactive. Please contact
Aurena Nails."_

### Admin panel

Dashboard with statistics and charts (appointments by month, new customers by month, popular services,
status distribution, recent activity) plus full management of **appointments, customers, services, gallery,
videos, categories, reviews, messages, website content, business hours, holidays and settings**
(booking rules, social links, SEO copy). Customers can be activated / deactivated / soft-deleted, reviews can
be hidden or deleted, messages marked read, gallery images reordered with drag & drop.

Also included: skeleton loaders, toast notifications and confirmations on every destructive action, friendly
error messages (never a stack trace), custom 404 / 401 / 403 / 500 pages, XML sitemap, `robots.txt`, semantic
HTML, keyboard-accessible controls, responsive layouts from 360 px upwards, and no horizontal scrolling.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 16 (App Router)** with React 19 and TypeScript 5 (strict) |
| Styling | **Tailwind CSS 4** with a custom design system in `src/app/globals.css` |
| Animation | **Framer Motion** (used sparingly: hero, cards, page transitions) |
| Forms | **React Hook Form** + **Zod 4** (the same Zod schemas validate on the server) |
| Icons | **Lucide** (+ a small set of hand-rolled brand marks) |
| Backend | Next.js **Server Actions** and **Route Handlers** — no separate API server |
| Database | **PostgreSQL** (Neon in production) through **Prisma ORM 7** |
| Auth | `jose` (HS256 JWT in an HTTP-only cookie) + `bcryptjs` password hashing |
| Media | **Cloudinary** for every image and video (URLs + metadata only in Postgres) |
| Email | `nodemailer` (password resets, booking notifications) — optional |
| Charts | Recharts |
| Toasts | Sonner |

---

## Quick start

Requirements: **Node.js ≥ 20.9** and npm. No database server needs to be installed — the project can start
a real, embedded PostgreSQL instance for development.

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Create your environment file and set a secret
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # paste into AUTH_SECRET

# 3. Start a local PostgreSQL server (writes to ./.local-postgres, port 5432)
npm run db:local:start        # keep this terminal open

# 4. Create the tables and load the seed data
npm run db:deploy
npm run db:seed

# 5. Start the site
npm run dev                   # http://localhost:3000
```

`npm run setup` runs steps 1, 4 and 5's prerequisites in one go (`prisma generate` → migrations → seed).

Sign in with the seeded accounts:

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@aurenanails.in` | `Aurena@2026` |
| Customer | `priya@example.com` | `Customer@123` |
| Customer | `ananya@example.com` | `Customer@123` |
| Customer | `meera@example.com` | `Customer@123` |

**Change the administrator password immediately** from `/profile` after your first sign-in.

---

## Environment variables

Copy `.env.example` to `.env` and fill in the values. `.env` is git-ignored; only `.env.example` is
committed.

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string. `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public`. Used by the Prisma CLI (`prisma.config.ts`) and by the app at runtime (`@prisma/adapter-pg`). |
| `AUTH_SECRET` | **Yes** | Random 32-byte base64 string that signs the session cookie. Changing it signs everybody out. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public origin (`https://aurenanails.com`). Used for metadata, `sitemap.xml`, `robots.txt` and password-reset links. |
| `CLOUDINARY_CLOUD_NAME` | Production | From the Cloudinary dashboard. |
| `CLOUDINARY_API_KEY` | Production | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Production | Cloudinary API secret — **server-side only, never exposed to the browser**. |
| `CLOUDINARY_FOLDER` | Optional | Sub-folder inside your Cloudinary account (default `aurena-nails`). |
| `EMAIL_SERVER` / `EMAIL_USERNAME` / `EMAIL_PASSWORD` / `EMAIL_PORT` / `EMAIL_SECURE` | Optional | SMTP credentials. When empty, reset links are printed to the server console instead of emailed. |
| `EMAIL_FROM` | Optional | From-header for outgoing mail. |

When the three `CLOUDINARY_*` credentials are empty the upload API automatically falls back to **local disk
storage** (`public/uploads`) so that development works without an account. Production deployments should
always set the Cloudinary credentials.

---

## Database setup

The app talks to PostgreSQL through Prisma. You can develop against a local server and deploy against Neon
without changing a single line of code — only `DATABASE_URL`.

### Option A — local PostgreSQL (no account needed)

```bash
npm run db:local:start     # embedded PostgreSQL 18 in ./.local-postgres (port 5432)
npm run db:local:stop      # stop it again (Ctrl+C in the same terminal also works)
```

The embedded server uses the credentials already present in `.env.example`:
`postgresql://aurena:aurena@localhost:5432/aurena_nails?schema=public`. Override the port with
`LOCAL_PG_PORT` if 5432 is taken.

Already have PostgreSQL installed? Create a database and point `DATABASE_URL` at it — nothing else changes.

### Option B — Neon (production database)

1. Create a free project at <https://console.neon.tech>.
2. Open **Dashboard → Connection string** and copy the **pooled** connection string
   (`...-pooler...?sslmode=require`). The pooler is what a serverless deployment should use.
3. Put it in `.env` (and later in your host's environment variables):

   ```bash
   DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
   ```

4. Apply the schema and the seed data once, from your machine:

   ```bash
   npm run db:deploy
   npm run db:seed
   ```

Nothing in the source code hard-codes a connection string: the CLI reads `DATABASE_URL` through
`prisma.config.ts`, and the running app reads the same variable through the `@prisma/adapter-pg` driver
adapter in `src/lib/db/prisma.ts`. TLS is enabled automatically whenever the URL contains
`sslmode=require`.

---

## Migrations

Migrations live in `prisma/migrations/` as plain SQL and are recorded in Prisma's `_prisma_migrations`
table, so the standard Prisma workflow applies:

```bash
npx prisma migrate dev --name add_something   # author + apply a migration (development)
npx prisma migrate deploy                     # apply pending migrations (production)
npx prisma generate                           # regenerate the typed client
npx prisma studio                             # browse the data in a GUI
npm run db:deploy                             # this repo's dependency-light deployer (see below)
npm run db:reset                              # drop everything and re-apply all migrations
npm run verify:schema                         # assert schema.prisma and the SQL migration agree
```

Three helper scripts exist because this project was developed in an environment where Prisma's native
engines could not be downloaded (`binaries.prisma.sh` unreachable). They are useful everywhere and safe to
keep:

- `npm run db:deploy` — applies pending SQL migrations with a raw `pg` client and keeps the
  `_prisma_migrations` bookkeeping identical to Prisma's, so `prisma migrate deploy` stays in sync.
  Supports `--status` and `--reset`.
- `npm run verify:schema` — a self-check that compares every table, column, index, constraint and relation
  in `schema.prisma` with the SQL in the migrations (801 assertions). Handy in CI.
- `scripts/prisma-generate.mjs` — runs `prisma generate` with a small WASM-backed schema-engine shim so the
  typed client can be generated offline. On a normal machine plain `npx prisma generate` works too.

**Prisma 7 note.** Prisma 7 no longer accepts a `url` inside the `datasource` block (error `P1012`). The
schema therefore declares only `provider = "postgresql"`, and the connection string is supplied by
`prisma.config.ts` (for CLI commands) and by the `@prisma/adapter-pg` driver adapter (for the runtime) —
both reading `DATABASE_URL`. The datasource provider, the migration workflow and every Prisma CLI command
behave exactly as in Prisma 6.

---

## Seeding the database

```bash
npm run db:seed
```

`prisma/seed.ts` is idempotent (everything is upserted), so it is safe to run repeatedly. It creates:

- 1 administrator and 3 customers with bcrypt-hashed passwords;
- the 7 rows of opening hours — **Mon–Fri 10:00–19:00, Sat 10:00–20:00, Sun closed**;
- 11 categories (services, gallery and videos);
- 8 services with photos, durations, informational pricing, preparation and after-care instructions;
- 6 gallery designs so `/gallery` is never empty on a fresh install;
- a little real history — 3 completed visits with published reviews, 2 upcoming appointments and a
  wishlist — so the admin dashboard charts, the testimonials and the service ratings are meaningful
  straight away (skipped automatically if the database already contains appointments).

The photos shipped in `public/seed/` are studio-style placeholder images. Replace them with real work by
uploading through the admin panel — every upload becomes a Cloudinary asset whose URL and metadata are
stored in Postgres.

---

## Cloudinary setup

Every image, video and thumbnail is uploaded **from the server** to Cloudinary; the database only stores the
URL, public id, file type / name, byte size, width, height, video duration and creation date. No binary data
is ever written to PostgreSQL.

1. Create a free account at <https://cloudinary.com>.
2. Dashboard → **Settings → API Keys** — copy the cloud name, API key and API secret.
3. Put them in `.env`:

   ```bash
   CLOUDINARY_CLOUD_NAME="your-cloud"
   CLOUDINARY_API_KEY="123456789012345"
   CLOUDINARY_API_SECRET="your-secret"
   ```

4. Restart the dev server. Uploads from the admin panel (service photos & videos, gallery images, video
   library, avatars) now go to Cloudinary.

Accepted types are validated on both the client and the server: images **JPG / JPEG / PNG / WEBP up to
8 MB**, videos **MP4 / WEBM / MOV up to 60 MB**. The gallery supports multi-file drag & drop with
previews, per-file progress and drag-to-reorder.

---

## Email setup

Email is optional. With SMTP configured, the app sends password-reset links and appointment notifications;
without it, `sendEmail()` returns `{ delivered: false, skippedReason: "SMTP_NOT_CONFIGURED" }` and the reset
link is printed to the server console so development is never blocked.

```bash
EMAIL_SERVER="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_SECURE="false"
EMAIL_USERNAME="you@gmail.com"
EMAIL_PASSWORD="an-app-password"        # Gmail: App Password, never your real password
EMAIL_FROM="Aurena Nails <hello@aurenanails.com>"
```

---

## Admin setup

The seed script creates the first administrator:

```txt
admin@aurenanails.in  /  Aurena@2026
```

Sign in at **`/admin/login`** — note that the admin sign-in screen is separate from the customer one, and
customers who try to open `/admin/*` are redirected to `/forbidden` instead of seeing admin data.

To promote another account, update its role in the database (or in Prisma Studio):

```bash
npx prisma studio        # Users → role → ADMIN
```

To create an admin from scratch:

```bash
npx tsx -e "
  import('./src/lib/auth/password').then(async ({ hashPassword }) => {
    const { prisma } = await import('./src/lib/db/prisma');
    await prisma.user.create({ data: {
      firstName: 'Studio', lastName: 'Owner',
      email: 'owner@aurenanails.in', mobile: '+919800000000',
      passwordHash: await hashPassword(process.env.NEW_PASSWORD),
      role: 'ADMIN',
    }});
    await prisma.\$disconnect();
  });
"
```

Administrators can never set a plain-text password anywhere: every password is hashed with bcrypt (cost 12)
before it reaches the database. Password reset tokens are stored **only as SHA-256 hashes**, expire after 30
minutes and can be used once.

---

## Running the app

```bash
npm run dev        # development server with hot reload   → http://localhost:3000
npm run build      # production build (generates the Prisma client first)
npm run start      # serve the production build
npm run lint       # ESLint
npm run typecheck  # TypeScript, no emit
```

---

## Deploying to production

The stack is designed for **Vercel + Neon + Cloudinary**.

1. **Database** — create a Neon project and copy the pooled connection string (see above).
2. **Apply the schema** from your machine, pointed at Neon:
   ```bash
   DATABASE_URL="postgresql://…-pooler…?sslmode=require" npm run db:deploy
   DATABASE_URL="postgresql://…-pooler…?sslmode=require" npm run db:seed
   ```
3. **Push the repository** to GitHub and import it in Vercel. The framework preset is detected
   automatically; the build command is `npm run build` (which runs `prisma generate` first).
4. **Set the environment variables** in Vercel — Project → Settings → Environment Variables:
   `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
   `CLOUDINARY_API_SECRET` (and the `EMAIL_*` values if you want mail). Never commit them.
5. **Redeploy** so the variables take effect, then confirm `/sitemap.xml`, `/robots.txt` and a booking flow
   on the live domain.

Any Node host works the same way (Render, Railway, Fly.io, a VPS with `npm run build && npm run start`).
Serverless/edge hosts are supported because the app uses the Neon-compatible driver adapter with a small,
reused connection pool.

**Production checklist**

- [ ] `AUTH_SECRET` is a fresh random value (not the development one)
- [ ] `DATABASE_URL` points at the Neon **pooler** with `sslmode=require`
- [ ] Cloudinary credentials set, so uploads do not land on ephemeral disk
- [ ] `NEXT_PUBLIC_APP_URL` matches the real domain
- [ ] The administrator password has been changed from the seeded one
- [ ] `npm run typecheck`, `npm run lint` and `npm run build` pass

---

## Route reference

### Public

| Route | Description |
| --- | --- |
| `/` | Home |
| `/services`, `/services/[slug]` | Service catalogue and detail |
| `/gallery`, `/gallery/[id]` | Nail-art gallery and design detail |
| `/videos`, `/videos/[id]` | Studio videos |
| `/booking` | Five-step appointment wizard |
| `/about`, `/contact` | Studio story and contact form |
| `/search?q=` | Global search |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Authentication |
| `/not-found`, `/forbidden`, `/unauthorized` | Friendly error screens |

### Customer (requires sign-in)

`/profile` · `/appointments` · `/wishlist` · `/notifications`

### Admin (requires the `ADMIN` role)

`/admin/login` · `/admin/dashboard` · `/admin/appointments` · `/admin/customers` · `/admin/services` ·
`/admin/gallery` · `/admin/videos` · `/admin/categories` · `/admin/reviews` · `/admin/messages` ·
`/admin/content` · `/admin/business-hours` · `/admin/holidays` · `/admin/settings`

### API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/upload` | Authenticated media upload (Cloudinary, or local disk in development) |
| `GET /api/availability?serviceId=&date=` | Slots for one day |
| `GET /api/availability?serviceId=&from=&days=` | Availability for a date range (drives the calendar) |
| `GET /api/search?q=` | Global search results (services, gallery, videos) |
| `POST /api/auth/logout` | Clears the session cookie |

---

## Project structure

```txt
aurena-nails/
├── prisma/
│   ├── schema.prisma               # 19 models, 4 enums — the single source of truth
│   ├── migrations/                 # plain SQL migrations (applied by Prisma or scripts/db-deploy.mjs)
│   └── seed.ts                     # npm run db:seed
├── public/
│   ├── favicon.svg
│   ├── seed/                       # placeholder studio photos used by the seed script
│   └── uploads/                    # local upload fallback (git-ignored)
├── scripts/
│   ├── prisma-generate.mjs         # offline-capable `prisma generate`
│   ├── offline-schema-engine.mjs   # WASM schema-engine shim used by the generator
│   ├── db-deploy.mjs               # applies migrations with a raw pg client
│   ├── local-postgres.mjs          # npm run db:local:start / stop
│   ├── load-env.mjs                # dependency-free .env loader for the scripts
│   └── verify-schema.mjs           # schema ↔ migration drift checker
├── src/
│   ├── app/
│   │   ├── (site)/                 # public pages (home, services, gallery, videos, booking, about, contact, search)
│   │   ├── (auth)/                 # login, register, forgot-password, reset-password
│   │   ├── (customer)/             # profile, appointments, wishlist, notifications
│   │   ├── admin/                  # admin login + (panel) route group with the guarded dashboard
│   │   ├── api/                    # upload, availability, search, logout route handlers
│   │   ├── error.tsx global-error.tsx not-found.tsx
│   │   ├── forbidden/ unauthorized/   # 403 and 401 screens
│   │   ├── sitemap.ts robots.ts    # SEO
│   │   ├── layout.tsx globals.css  # fonts, metadata, design system
│   │   └── proxy.ts                # route guard (Next.js "proxy", successor of middleware)
│   ├── components/
│   │   ├── ui/                     # toaster, primitives, interactive bits, image uploader, brand icons
│   │   ├── site/                   # header, footer, cards, gallery, filters, booking wizard, contact form
│   │   ├── auth/ customer/ admin/  # forms and action buttons per area
│   ├── lib/
│   │   ├── db/prisma.ts            # PrismaClient + @prisma/adapter-pg singleton
│   │   ├── auth/                   # session (jose) and password (bcrypt) helpers
│   │   ├── content/defaults.ts     # typed website-content registry
│   │   ├── media/storage.ts        # Cloudinary upload + local fallback
│   │   ├── time.ts availability…   # timezone-aware date helpers
│   │   ├── format.ts utils.ts validation.ts constants.ts errors.ts
│   ├── server/
│   │   ├── actions/                # server actions (auth, booking, customer, admin/*)
│   │   ├── services/               # the business-logic layer — all database access lives here
│   │   └── email/                  # nodemailer transport + templates
│   └── validators/                 # Zod schemas shared by client forms and server actions
├── next.config.ts                  # image domains, security headers, external packages
├── prisma.config.ts                # Prisma 7 CLI configuration (datasource URL, seed command)
└── .env.example
```

---

## How the app is built

**Layers.** UI components never touch Prisma. A page or a form calls a **server action**, which validates
its input with a **Zod schema** from `src/validators/`, then calls a function in `src/server/services/*`
where the database work happens. Every service function is `server-only`, and every admin mutation also
writes an `AuditLog` row. This keeps the rules in one place and makes an admin action impossible to bypass
from the browser.

**Auth.** Sign-in verifies a bcrypt hash, then sets an HTTP-only, `SameSite=Lax` cookie containing a signed
`jose` JWT (30 days, or 24 hours without "remember me"). `src/proxy.ts` performs a cheap cookie check on
protected prefixes so people land on the right screen immediately, but it is **not** the security boundary:
`requireUser()` and `requireAdmin()` re-read the user from PostgreSQL inside every server action and route
handler, so a stale cookie can never reach admin data. Deactivated accounts lose access on the next request.

**Media.** `POST /api/upload` authenticates the caller, validates the MIME type and size, uploads to
Cloudinary (or `public/uploads` when Cloudinary is not configured) and returns the URL plus metadata. Only
that metadata is persisted.

**Errors and polish.** Server actions return a typed `ActionResult` (`{ ok, data }` / `{ ok: false, error,
fieldErrors }`); forms surface field errors inline and everything else through a toast, always with a
human-readable message — never a Prisma or Node stack trace. Lists have skeleton loaders, destructive
buttons show a confirmation dialog, and empty states explain what to do next.

**SEO & accessibility.** Per-page metadata and Open Graph tags, JSON-LD for services and videos, a generated
`sitemap.xml` (that falls back to static routes if the database is unreachable) and `robots.txt`. Semantic
landmarks, labelled form controls, visible focus states, `aria-*` attributes on interactive widgets, alt
text on every image and colour contrast tuned to the blush-and-cream palette.

---

## Database schema notes

19 models, 4 enums, every table with a primary key, `createdAt` and `updatedAt`, plus foreign keys,
unique constraints and indexes on the columns that are filtered or sorted.

`User`, `Service`, `ServiceImage`, `ServiceVideo`, `GalleryImage`, `Video`, `Appointment`, `Wishlist`,
`Review`, `ContactMessage`, `Notification`, `PasswordResetToken`, `WebsiteContent`, `BusinessHours`,
`Holiday`, `Category`, `WishlistItem`, `AppointmentEvent`, `AuditLog`.

Deliberate design decisions, in case you extend the schema:

| Decision | Why |
| --- | --- |
| **One `Category` table with a `CategoryType` enum** (`SERVICE` / `GALLERY` / `VIDEO`) instead of three near-identical tables. | One CRUD screen, one sort order, no duplicated code — the type column keeps the areas separate. |
| **`AppointmentEvent`** (who changed which status, when, with an optional note). | The appointment history is auditable; admins can leave a note with a status change. |
| **`AuditLog`** on admin mutations. | Review moderation and content edits must never silently rewrite customer-authored data. |
| **Appointments store `date` (`@db.Date`) + `startMinutes` / `endMinutes`** and a snapshot of `durationMinutes`. | Integer minutes are timezone-proof and make overlap queries trivial; the snapshot keeps history accurate if a service's duration changes later. |
| **`Review` has `@@unique([userId, serviceId])`.** | One review per customer per service, editable afterwards. |
| **`Wishlist` is one row per user; `WishlistItem` has a CHECK constraint** so it points at exactly one of a service or a gallery design. | The wishlist works for both areas without a polymorphic mess; there is still no cart. |
| **`PasswordResetToken` stores only a SHA-256 `tokenHash`**, with an expiry and a `usedAt` timestamp. | A leaked database cannot be turned into account takeovers. |
| **`Service.ratingAverage` / `ratingCount`** are cached aggregates. | Service lists and filters can sort by rating without an aggregate query per row; they are recalculated whenever a review changes. |
| **No media bytes in Postgres.** | Only URLs, public ids and metadata — the requirement for Cloudinary. |

---

## Available scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Generates the Prisma client, then builds for production |
| `npm run start` | Serves the production build |
| `npm run lint` | ESLint (Next.js config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run setup` | Generate client → apply migrations → seed |
| `npm run db:generate` | Regenerate the typed Prisma client |
| `npm run db:deploy` | Apply migrations (`--status`, `--reset` supported) |
| `npm run db:migrate` | `prisma migrate dev` — author a new migration |
| `npm run db:studio` | Prisma Studio GUI |
| `npm run db:seed` | Seed administrator, customers, hours, categories, services, gallery |
| `npm run db:reset` | Drop the schema and re-apply every migration |
| `npm run db:local:start` / `db:local:stop` | Start / stop the embedded development PostgreSQL |
| `npm run verify:schema` | Check `schema.prisma` against the SQL migrations |

---

## Troubleshooting

**`DATABASE_URL is not set`** — copy `.env.example` to `.env` and fill it in. The Prisma CLI reads it via
`prisma.config.ts`; the app reads it in `src/lib/db/prisma.ts`.

**`Can't reach database server at localhost:5432`** — the local server is not running: `npm run
db:local:start`, or point `DATABASE_URL` at Neon. If port 5432 is busy, set `LOCAL_PG_PORT=55432` and use the
printed URL.

**`P1012` / "the datasource `url` is no longer supported"** — you are on Prisma 7, where the URL belongs in
`prisma.config.ts`, not in `schema.prisma`. Keep `DATABASE_URL` in the environment; do not add `url =` back.

**Uploads disappear after a redeploy** — Cloudinary is not configured, so files were written to
`public/uploads` on ephemeral disk. Set the three `CLOUDINARY_*` variables.

**Password-reset emails never arrive** — `EMAIL_SERVER` is empty. The reset link is printed to the server
console instead; configure SMTP for real delivery.

**`npm run verify:schema` fails after editing the schema** — you changed `schema.prisma` without adding a
migration. Run `npx prisma migrate dev --name your_change` (or hand-write the SQL in
`prisma/migrations/`), then `npm run db:deploy`.

---

## Licence

Private project. All rights reserved by Aurena Nails.
