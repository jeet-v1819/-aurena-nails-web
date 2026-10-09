/**
 * Database seed — `npm run db:seed` (or `npx prisma db seed`).
 *
 * Creates the initial administrator using SEED_ADMIN_EMAIL and
 * SEED_ADMIN_PASSWORD. Optional demo data is enabled only with
 * SEED_DEMO_DATA=true and requires a separate SEED_DEMO_PASSWORD.
 *
 * The seed is idempotent and deliberately never prints passwords or resets an
 * existing administrator's password. Production seeds create only the admin
 * unless demo data is explicitly requested.
 */
import { loadEnv } from "../scripts/load-env.mjs";

// Prisma 7 no longer loads `.env` automatically, and the client reads
// DATABASE_URL when it is constructed — so the environment comes first.
loadEnv({ cwd: process.cwd() });

const ADMIN = {
  firstName: process.env.SEED_ADMIN_FIRST_NAME?.trim() || "Studio",
  lastName: process.env.SEED_ADMIN_LAST_NAME?.trim() || "Administrator",
  email: process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() ?? "",
  mobile: process.env.SEED_ADMIN_MOBILE?.trim() || "+919820045678",
  password: process.env.SEED_ADMIN_PASSWORD ?? "",
};

const CUSTOMERS = [
  { firstName: "Priya", lastName: "Menon", email: "priya@example.com", mobile: "+919812345670" },
  { firstName: "Ananya", lastName: "Rao", email: "ananya@example.com", mobile: "+919812345671" },
  { firstName: "Meera", lastName: "Kapoor", email: "meera@example.com", mobile: "+919812345672" },
];
const DEMO_DATA_ENABLED = process.env.SEED_DEMO_DATA === "true";
const CUSTOMER_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "";

const SERVICE_CATEGORIES = [
  { name: "Gel Nails", slug: "gel-nails", description: "Long-lasting gel polish and gel extensions.", sortOrder: 1 },
  { name: "Acrylic Nails", slug: "acrylic-nails", description: "Sculpted acrylic sets built for strength.", sortOrder: 2 },
  { name: "Nail Art", slug: "nail-art", description: "Hand-painted art, chrome, French and more.", sortOrder: 3 },
  { name: "Bridal & Occasion", slug: "bridal-nails", description: "Wedding, engagement and festive designs.", sortOrder: 4 },
  { name: "Manicure & Care", slug: "manicure-care", description: "Cuticle care, shaping and nail health.", sortOrder: 5 },
];

const GALLERY_CATEGORIES = [
  { name: "Bridal", slug: "bridal", description: "Designs created for wedding days.", sortOrder: 1 },
  { name: "Minimal", slug: "minimal", description: "Clean, understated everyday sets.", sortOrder: 2 },
  { name: "Chrome & Glitter", slug: "chrome-glitter", description: "Mirror finishes and sparkle.", sortOrder: 3 },
  { name: "Festive", slug: "festive", description: "Seasons, festivals and celebrations.", sortOrder: 4 },
];

const VIDEO_CATEGORIES = [
  { name: "Studio & Process", slug: "studio-process", description: "How a set is built, start to finish.", sortOrder: 1 },
  { name: "After-care", slug: "after-care", description: "Looking after your nails between visits.", sortOrder: 2 },
];

type ServiceSeed = {
  name: string;
  slug: string;
  category: string;
  shortDescription: string;
  description: string;
  durationMinutes: number;
  startingPrice: number;
  nailType: string;
  style: string;
  occasion: string;
  difficulty: string;
  isFeatured: boolean;
  image: string;
  imageAlt: string;
  preparationInstructions: string;
  afterCareInstructions: string;
};

const SERVICES: ServiceSeed[] = [
  {
    name: "Classic Gel Manicure",
    slug: "classic-gel-manicure",
    category: "gel-nails",
    shortDescription: "Cuticle care, shaping and a flawless gel colour that stays glossy for weeks.",
    description:
      "A full manicure that starts with nail health: cuticle work, careful shaping and light buffing so the gel grips evenly.\nWe build the colour in thin layers and cure each one under a lamp, which is what keeps the finish slim and mirror-smooth.\nThe perfect first appointment, or a reset between extension sets.",
    durationMinutes: 60,
    startingPrice: 899,
    nailType: "Gel",
    style: "Minimal",
    occasion: "Casual",
    difficulty: "Easy",
    isFeatured: true,
    image: "/seed/design-french.jpg",
    imageAlt: "Classic gel manicure with a glossy nude finish",
    preparationInstructions:
      "Come with clean, product-free nails,\nBring a colour reference if you have one,\nArrive having eaten — the appointment takes an hour.",
    afterCareInstructions:
      "Apply cuticle oil daily,\nAvoid soaking your nails for the first 24 hours,\nBook your next appointment in 2–3 weeks.",
  },
  {
    name: "Gel Extensions",
    slug: "gel-extensions",
    category: "gel-nails",
    shortDescription: "Light, strong builder-gel extensions shaped to suit your hands.",
    description:
      "Builder gel is sculpted over your natural nail to add length and shape without the weight of acrylic.\nEvery tip is shaped to your nail bed, then finished in the colour or design you choose.\nIdeal while you grow your natural nails out, or when you want an elegant almond or square shape.",
    durationMinutes: 120,
    startingPrice: 1899,
    nailType: "Builder Gel",
    style: "Minimal",
    occasion: "Casual",
    difficulty: "Moderate",
    isFeatured: true,
    image: "/seed/design-french.jpg",
    imageAlt: "Gel extensions in a soft natural shape",
    preparationInstructions:
      "Come with bare nails if possible,\nChoose your shape before we start,\nAllow two hours.",
    afterCareInstructions:
      "Book an infill every three weeks,\nWear gloves for cleaning and washing up,\nNever peel the gel — book a removal instead.",
  },
  {
    name: "Acrylic Full Set",
    slug: "acrylic-full-set",
    category: "acrylic-nails",
    shortDescription: "Hand-sculpted acrylic extensions for maximum strength and length.",
    description:
      "A full set of acrylic extensions, individually sculpted, filed and shaped to the length you want.\nAcrylic is the right choice when you need durability — it survives a busy month of work, travel and family.\nFinished with a high-shine top coat, or with hand-painted nail art.",
    durationMinutes: 150,
    startingPrice: 2499,
    nailType: "Acrylic",
    style: "Ombre",
    occasion: "Party",
    difficulty: "Advanced",
    isFeatured: true,
    image: "/seed/design-chrome.jpg",
    imageAlt: "Full set of sculpted acrylic extensions",
    preparationInstructions:
      "Arrive with clean nails,\nBring inspiration photos,\nBook a removal first if you currently have product on.",
    afterCareInstructions:
      "Use cuticle oil twice a day,\nKeep your nails away from harsh detergents,\nReturn every 2–4 weeks for infills.",
  },
  {
    name: "Acrylic Refill",
    slug: "acrylic-refill",
    category: "acrylic-nails",
    shortDescription: "Rebalance and refresh an existing acrylic set in about 90 minutes.",
    description:
      "We file back the grown-out area, rebalance the apex and refill with fresh acrylic so the set looks new again.\nRefills are kinder to your natural nails — and to your wallet — than removing and rebuilding each time.\nBest booked three to four weeks after your full set.",
    durationMinutes: 90,
    startingPrice: 1299,
    nailType: "Acrylic",
    style: "Minimal",
    occasion: "Casual",
    difficulty: "Advanced",
    image: "/seed/design-chrome.jpg",
    imageAlt: "Acrylic refill with a freshly rebalanced shape",
    isFeatured: false,
    preparationInstructions: "Do not pick or peel the existing set before your appointment.",
    afterCareInstructions: "Keep the shape filed short if you type a lot,\nContinue oiling your cuticles daily.",
  },
  {
    name: "Chrome French Tips",
    slug: "chrome-french-tips",
    category: "nail-art",
    shortDescription: "The classic French manicure, reimagined with a soft mirror-chrome finish.",
    description:
      "Crisp tips in chrome, pearl or glitter over a natural nail bed — a modern take on the French manicure.\nThe chrome powder is burnished into the gel top coat, so the finish is smooth rather than textured.\nPopular for weddings, festive season, and for anyone who wants an elegant set that still feels understated.",
    durationMinutes: 75,
    startingPrice: 1599,
    nailType: "Gel",
    style: "Chrome",
    occasion: "Festive",
    difficulty: "Moderate",
    isFeatured: true,
    image: "/seed/design-chrome.jpg",
    imageAlt: "French tips finished with chrome powder",
    preparationInstructions:
      "Grow your nails a little if you would like a longer tip,\nBring a photo of the chrome tone you prefer.",
    afterCareInstructions:
      "Avoid abrasive cleaning products,\nKeep the tips shorter than usual if you type a lot.",
  },
  {
    name: "Hand-Painted Nail Art",
    slug: "hand-painted-nail-art",
    category: "nail-art",
    shortDescription: "Bring an idea — florals, marble, abstract lines — and we will paint it freehand.",
    description:
      "A design session for the ideas that do not fit a template: marble, abstract strokes, florals, constellations, initials.\nWe talk through what will work on your nail length, sketch the layout together and paint it freehand — never a sticker.\nPricing depends on how many nails are decorated; your artist confirms the exact price before starting.",
    durationMinutes: 105,
    startingPrice: 1999,
    nailType: "Gel",
    style: "Abstract",
    occasion: "Party",
    difficulty: "Advanced",
    isFeatured: false,
    image: "/seed/design-bridal.jpg",
    imageAlt: "Hand-painted floral nail art",
    preparationInstructions:
      "Bring references — screenshots are perfect,\nDecide which nails you would like decorated.",
    afterCareInstructions: "Avoid picking at any raised detail,\nKeep a cuticle oil in your bag.",
  },
  {
    name: "Bridal Nail Design",
    slug: "bridal-nail-design",
    category: "bridal-nails",
    shortDescription: "A complete bridal set: extensions, art, pearls and a trial consultation.",
    description:
      "Designed for your wedding day, this appointment begins with a consultation so the nails match your outfit, jewellery and mehndi.\nThe set is built with gel or acrylic extensions, then decorated with hand-painted detail, pearls or a subtle glitter ombré.\nBook a trial two to three weeks before the wedding and the final set one or two days before the event.",
    durationMinutes: 180,
    startingPrice: 4499,
    nailType: "Polygel",
    style: "3D Art",
    occasion: "Bridal",
    difficulty: "Master",
    isFeatured: true,
    image: "/seed/design-bridal.jpg",
    imageAlt: "Bridal nail set with pearls and ombré",
    preparationInstructions:
      "Book a trial before your wedding,\nShare photos of your outfit and jewellery,\nKeep a small buffer before the final fitting.",
    afterCareInstructions:
      "Apply cuticle oil morning and night,\nKeep a spare set of press-ons for the honeymoon,\nMessage us if anything lifts — we will fix it.",
  },
  {
    name: "Spa Manicure & Cuticle Care",
    slug: "spa-manicure",
    category: "manicure-care",
    shortDescription: "A restorative manicure focused on nail health, cuticles and hydration.",
    description:
      "Our gentlest treatment: a warm soak, careful cuticle work, shaping and a nourishing massage with oil and hand cream.\nNo gel or polish unless you ask for it — the focus is recovery after extensions, or on nails that feel dry and brittle.\nStrongly recommended between gel sets.",
    durationMinutes: 45,
    startingPrice: 699,
    nailType: "Natural",
    style: "Minimal",
    occasion: "Casual",
    difficulty: "Easy",
    isFeatured: false,
    image: "/seed/studio-2.jpg",
    imageAlt: "Spa manicure and cuticle care treatment",
    preparationInstructions: "No preparation needed — come as you are.",
    afterCareInstructions:
      "Keep cuticles moisturised daily,\nBook every four weeks to maintain nail health.",
  },
];

const GALLERY = [
  {
    title: "Soft French with gold accents",
    category: "minimal",
    url: "/seed/design-french.jpg",
    description: "Classic French tips on a sheer nude base, with a single gold accent nail.",
    tags: ["french", "nude", "minimal", "office"],
    style: "French",
    occasion: "Office",
    isFeatured: true,
  },
  {
    title: "Chrome ombré almond set",
    category: "chrome-glitter",
    url: "/seed/design-chrome.jpg",
    description: "Pearl-to-rose-gold chrome ombré on almond extensions.",
    tags: ["chrome", "ombré", "glitter", "party"],
    style: "Chrome",
    occasion: "Party",
    isFeatured: true,
  },
  {
    title: "Bridal pearls with ombré",
    category: "bridal",
    url: "/seed/design-bridal.jpg",
    description: "Blush-to-white ombré, hand-painted florals and tiny pearls for a wedding day.",
    tags: ["bridal", "pearls", "ombré", "wedding"],
    style: "3D Art",
    occasion: "Bridal",
    isFeatured: true,
  },
  {
    title: "Nude base with hand-painted florals",
    category: "minimal",
    url: "/seed/design-french.jpg",
    description: "A soft nude base with delicate freehand florals on two accent nails.",
    tags: ["floral", "nude", "minimal"],
    style: "Abstract",
    occasion: "Casual",
    isFeatured: false,
  },
  {
    title: "Festive glitter gradient",
    category: "festive",
    url: "/seed/design-chrome.jpg",
    description: "A sparkling glitter gradient built for the festive season.",
    tags: ["glitter", "festive", "gradient"],
    style: "Glitter",
    occasion: "Festive",
    isFeatured: false,
  },
  {
    title: "Bridal almond extensions",
    category: "bridal",
    url: "/seed/design-bridal.jpg",
    description: "Sculpted almond extensions with a soft white tip and a subtle shimmer.",
    tags: ["bridal", "almond", "extensions"],
    style: "Ombre",
    occasion: "Bridal",
    isFeatured: false,
  },
];

/** Completed visits that come with a published review. */
const DEMO_VISITS = [
  {
    email: "priya@example.com",
    service: "classic-gel-manicure",
    daysAgo: 24,
    startMinutes: 11 * 60,
    rating: 5,
    comment: "The most careful manicure I have had in years — three weeks later the gel still looked perfect.",
  },
  {
    email: "ananya@example.com",
    service: "bridal-nail-design",
    daysAgo: 52,
    startMinutes: 14 * 60,
    rating: 5,
    comment: "My wedding set was flawless. The pearls and the ombré matched my saree exactly.",
  },
  {
    email: "meera@example.com",
    service: "spa-manicure",
    daysAgo: 12,
    startMinutes: 16 * 60,
    rating: 4,
    comment: "Such a relaxing appointment and my cuticles have never looked better.",
  },
];

/** Upcoming appointments, so the dashboard and the booking calendar have life. */
const DEMO_UPCOMING = [
  { email: "priya@example.com", service: "gel-extensions", inDays: 3, startMinutes: 12 * 60, status: "PENDING" as const },
  { email: "ananya@example.com", service: "chrome-french-tips", inDays: 6, startMinutes: 15 * 60 + 30, status: "CONFIRMED" as const },
];

/** Opening hours: minutes from midnight, studio local time. */
const BUSINESS_HOURS = [
  { dayOfWeek: 0, isOpen: false, openMinutes: 600, closeMinutes: 1140, note: "The studio is closed on Sundays." },
  { dayOfWeek: 1, isOpen: true, openMinutes: 600, closeMinutes: 1140 },
  { dayOfWeek: 2, isOpen: true, openMinutes: 600, closeMinutes: 1140 },
  { dayOfWeek: 3, isOpen: true, openMinutes: 600, closeMinutes: 1140 },
  { dayOfWeek: 4, isOpen: true, openMinutes: 600, closeMinutes: 1140 },
  { dayOfWeek: 5, isOpen: true, openMinutes: 600, closeMinutes: 1140 },
  { dayOfWeek: 6, isOpen: true, openMinutes: 600, closeMinutes: 1200, note: "Saturday is our busiest day — book early." },
];

/** Calendar date (UTC midnight) `offset` days from today. */
function dateOnlyFrom(offset: number) {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  base.setUTCDate(base.getUTCDate() + offset);
  return base;
}

/** Things that must be imported after the environment file has been loaded. */
type Runtime = {
  prisma: typeof import("../src/lib/db/prisma").prisma;
  hashPassword: typeof import("../src/lib/auth/password").hashPassword;
};

async function seedUsers(runtime: Runtime) {
  // Passwords are hashed with the same helper the application uses (bcrypt, cost 12).
  const adminHash = await runtime.hashPassword(ADMIN.password);
  const adminProfile = {
    firstName: ADMIN.firstName,
    lastName: ADMIN.lastName,
    email: ADMIN.email,
    mobile: ADMIN.mobile,
  };
  const admin = await runtime.prisma.user.upsert({
    where: { email: ADMIN.email },
    update: { role: "ADMIN", isActive: true },
    create: { ...adminProfile, passwordHash: adminHash, role: "ADMIN", isActive: true },
  });

  if (DEMO_DATA_ENABLED) {
    const customerHash = await runtime.hashPassword(CUSTOMER_PASSWORD);
    for (const customer of CUSTOMERS) {
      await runtime.prisma.user.upsert({
        where: { email: customer.email },
        update: { isActive: true },
        create: { ...customer, passwordHash: customerHash, role: "CUSTOMER", isActive: true },
      });
    }
  }

  console.log(`✓ users (1 admin${DEMO_DATA_ENABLED ? `, ${CUSTOMERS.length} demo customers` : ""})`);
  return admin;
}

async function seedCategories(runtime: Runtime) {
  const ids: Record<string, string> = {};

  const rows = [
    ...SERVICE_CATEGORIES.map((category) => ({ ...category, type: "SERVICE" as const })),
    ...GALLERY_CATEGORIES.map((category) => ({ ...category, type: "GALLERY" as const })),
    ...VIDEO_CATEGORIES.map((category) => ({ ...category, type: "VIDEO" as const })),
  ];

  for (const row of rows) {
    const category = await runtime.prisma.category.upsert({
      where: { type_slug: { type: row.type, slug: row.slug } },
      update: { name: row.name, description: row.description, sortOrder: row.sortOrder },
      create: {
        name: row.name,
        slug: row.slug,
        type: row.type,
        description: row.description,
        sortOrder: row.sortOrder,
        isActive: true,
      },
    });
    ids[`${row.type}:${row.slug}`] = category.id;
  }

  console.log(`✓ categories (${rows.length} across services, gallery and videos)`);
  return ids;
}

async function seedBusinessHours(runtime: Runtime) {
  for (const day of BUSINESS_HOURS) {
    await runtime.prisma.businessHours.upsert({
      where: { dayOfWeek: day.dayOfWeek },
      update: {
        isOpen: day.isOpen,
        openMinutes: day.openMinutes,
        closeMinutes: day.closeMinutes,
        note: day.note ?? null,
      },
      create: {
        dayOfWeek: day.dayOfWeek,
        isOpen: day.isOpen,
        openMinutes: day.openMinutes,
        closeMinutes: day.closeMinutes,
        note: day.note ?? null,
      },
    });
  }

  console.log("✓ opening hours (Mon–Fri 10:00–19:00, Sat 10:00–20:00, Sun closed)");
}

async function seedServices(runtime: Runtime, categoryIds: Record<string, string>) {
  for (const [index, service] of SERVICES.entries()) {
    const categoryId = categoryIds[`SERVICE:${service.category}`];
    if (!categoryId) throw new Error(`Missing category for service "${service.slug}"`);

    const row = await runtime.prisma.service.upsert({
      where: { slug: service.slug },
      update: {
        name: service.name,
        shortDescription: service.shortDescription,
        description: service.description,
        categoryId,
        durationMinutes: service.durationMinutes,
        startingPrice: service.startingPrice,
        preparationInstructions: service.preparationInstructions,
        afterCareInstructions: service.afterCareInstructions,
        isActive: true,
        isAvailable: true,
        sortOrder: index + 1,
      },
      create: {
        name: service.name,
        slug: service.slug,
        shortDescription: service.shortDescription,
        description: service.description,
        categoryId,
        durationMinutes: service.durationMinutes,
        startingPrice: service.startingPrice,
        regularPrice: service.startingPrice,
        currency: "INR",
        nailType: service.nailType,
        style: service.style,
        occasion: service.occasion,
        difficulty: service.difficulty,
        preparationInstructions: service.preparationInstructions,
        afterCareInstructions: service.afterCareInstructions,
        isActive: true,
        isFeatured: service.isFeatured,
        isAvailable: true,
        sortOrder: index + 1,
      },
    });

    // The main photo. Replaced on every run so a renamed seed image stays in sync.
    const existing = await runtime.prisma.serviceImage.findFirst({
      where: { serviceId: row.id, isPrimary: true },
    });
    if (existing) {
      await runtime.prisma.serviceImage.update({
        where: { id: existing.id },
        data: { url: service.image, alt: service.imageAlt },
      });
    } else {
      await runtime.prisma.serviceImage.create({
        data: {
          serviceId: row.id,
          url: service.image,
          alt: service.imageAlt,
          fileType: "image/jpeg",
          isPrimary: true,
          sortOrder: 0,
        },
      });
    }
  }

  console.log(`✓ services (${SERVICES.length} with photos, prices and instructions)`);
}

async function seedGallery(runtime: Runtime, categoryIds: Record<string, string>) {
  for (const [index, design] of GALLERY.entries()) {
    const categoryId = categoryIds[`GALLERY:${design.category}`];
    if (!categoryId) throw new Error(`Missing gallery category "${design.category}"`);

    const existing = await runtime.prisma.galleryImage.findFirst({ where: { title: design.title } });
    if (existing) {
      await runtime.prisma.galleryImage.update({
        where: { id: existing.id },
        data: { url: design.url, categoryId, tags: design.tags, isActive: true },
      });
      continue;
    }

    await runtime.prisma.galleryImage.create({
      data: {
        title: design.title,
        description: design.description,
        categoryId,
        url: design.url,
        alt: design.title,
        format: "jpg",
        tags: design.tags,
        style: design.style,
        occasion: design.occasion,
        designDate: dateOnlyFrom(-(index + 3) * 7),
        isFeatured: design.isFeatured,
        isActive: true,
        sortOrder: index + 1,
      },
    });
  }

  console.log(`✓ gallery designs (${GALLERY.length})`);
}

/**
 * A small, believable history: completed visits with published reviews, two
 * upcoming appointments, a wishlist and a welcome notification.
 *
 * Skipped when the database already has appointments, so it never duplicates or
 * fights with real data.
 */
async function seedDemoHistory(runtime: Runtime) {
  if ((await runtime.prisma.appointment.count()) > 0) {
    console.log("↷ demo appointments already present — skipped");
    return;
  }

  const admin = await runtime.prisma.user.findUniqueOrThrow({ where: { email: ADMIN.email } });
  let visits = 0;

  for (const visit of DEMO_VISITS) {
    const user = await runtime.prisma.user.findUnique({ where: { email: visit.email } });
    const service = await runtime.prisma.service.findUnique({ where: { slug: visit.service } });
    if (!user || !service) continue;

    const day = dateOnlyFrom(-visit.daysAgo);
    const appointment = await runtime.prisma.appointment.create({
      data: {
        reference: `AUR-DEMO${visit.daysAgo}`,
        userId: user.id,
        serviceId: service.id,
        date: day,
        startMinutes: visit.startMinutes,
        endMinutes: visit.startMinutes + service.durationMinutes,
        durationMinutes: service.durationMinutes,
        status: "COMPLETED",
        completedAt: day,
        handledById: admin.id,
        quotedPrice: service.startingPrice,
      },
    });

    await runtime.prisma.appointmentEvent.createMany({
      data: [
        { appointmentId: appointment.id, status: "PENDING", note: "Requested online", actorId: user.id, createdAt: day },
        { appointmentId: appointment.id, status: "CONFIRMED", note: "Confirmed by the studio", actorId: admin.id, createdAt: day },
        { appointmentId: appointment.id, status: "COMPLETED", note: "Visit completed", actorId: admin.id, createdAt: day },
      ],
    });

    await runtime.prisma.review.create({
      data: {
        userId: user.id,
        serviceId: service.id,
        appointmentId: appointment.id,
        rating: visit.rating,
        comment: visit.comment,
        isVisible: true,
      },
    });

    // Keep the cached aggregate on the service in step with the new review.
    const aggregate = await runtime.prisma.review.aggregate({
      where: { serviceId: service.id, isVisible: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await runtime.prisma.service.update({
      where: { id: service.id },
      data: {
        ratingAverage: Number((aggregate._avg.rating ?? 0).toFixed(2)),
        ratingCount: aggregate._count._all,
      },
    });

    visits += 1;
  }

  for (const upcoming of DEMO_UPCOMING) {
    const user = await runtime.prisma.user.findUnique({ where: { email: upcoming.email } });
    const service = await runtime.prisma.service.findUnique({ where: { slug: upcoming.service } });
    if (!user || !service) continue;

    const appointment = await runtime.prisma.appointment.create({
      data: {
        reference: `AUR-UP0${upcoming.inDays}`,
        userId: user.id,
        serviceId: service.id,
        date: dateOnlyFrom(upcoming.inDays),
        startMinutes: upcoming.startMinutes,
        endMinutes: upcoming.startMinutes + service.durationMinutes,
        durationMinutes: service.durationMinutes,
        status: upcoming.status,
        customerNote: "Looking forward to it!",
        handledById: upcoming.status === "CONFIRMED" ? admin.id : null,
      },
    });

    await runtime.prisma.appointmentEvent.create({
      data: {
        appointmentId: appointment.id,
        status: upcoming.status,
        note: upcoming.status === "CONFIRMED" ? "Confirmed by the studio" : "Requested online",
        actorId: upcoming.status === "CONFIRMED" ? admin.id : user.id,
      },
    });

    const time = `${String(Math.floor(upcoming.startMinutes / 60)).padStart(2, "0")}:${String(
      upcoming.startMinutes % 60
    ).padStart(2, "0")}`;
    await runtime.prisma.notification.create({
      data: {
        userId: user.id,
        type: "APPOINTMENT",
        title: upcoming.status === "CONFIRMED" ? "Appointment confirmed" : "Appointment request received",
        message: `${service.name} on ${appointment.date.toISOString().slice(0, 10)} at ${time}.`,
        link: "/appointments",
      },
    });
  }

  // A wishlist holding one service and one design, so the account area has content.
  const priya = await runtime.prisma.user.findUnique({ where: { email: "priya@example.com" } });
  if (priya) {
    const wishlist = await runtime.prisma.wishlist.upsert({
      where: { userId: priya.id },
      update: {},
      create: { userId: priya.id },
    });
    const savedService = await runtime.prisma.service.findUnique({ where: { slug: "bridal-nail-design" } });
    const savedDesign = await runtime.prisma.galleryImage.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });

    await runtime.prisma.wishlistItem.createMany({
      data: [
        ...(savedService ? [{ wishlistId: wishlist.id, serviceId: savedService.id }] : []),
        ...(savedDesign ? [{ wishlistId: wishlist.id, galleryImageId: savedDesign.id }] : []),
      ],
      skipDuplicates: true,
    });

    await runtime.prisma.notification.create({
      data: {
        userId: priya.id,
        type: "ACCOUNT",
        title: "Welcome to Aurena Nails",
        message: "Your account is ready. Save your favourite designs and book whenever you like.",
        link: "/gallery",
      },
    });
  }

  console.log(`✓ demo history (${visits} completed visits with reviews, ${DEMO_UPCOMING.length} upcoming, 1 wishlist)`);
}

async function main() {
  if (!ADMIN.email || !ADMIN.password) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before running the database seed.");
  }
  if (DEMO_DATA_ENABLED && !CUSTOMER_PASSWORD) {
    throw new Error("SEED_DEMO_DATA=true requires a private SEED_DEMO_PASSWORD.");
  }
  if (process.env.NODE_ENV === "production" && DEMO_DATA_ENABLED && process.env.ALLOW_PRODUCTION_DEMO_SEED !== "true") {
    throw new Error("Refusing to seed demo accounts and appointments in production without ALLOW_PRODUCTION_DEMO_SEED=true.");
  }

  // Imported lazily: these modules read DATABASE_URL when they are evaluated, so
  // the environment has to be loaded first. (tsx compiles this file to CommonJS,
  // where top-level `await` is not allowed — hence the dynamic imports.)
  const { prisma } = await import("../src/lib/db/prisma");
  const { hashPassword } = await import("../src/lib/auth/password");
  const runtime: Runtime = { prisma, hashPassword };

  console.log("Seeding Aurena Nails…\n");
  await seedUsers(runtime);

  if (DEMO_DATA_ENABLED) {
    const categoryIds = await seedCategories(runtime);
    await seedBusinessHours(runtime);
    await seedServices(runtime, categoryIds);
    await seedGallery(runtime, categoryIds);
    await seedDemoHistory(runtime);
  }

  console.log("\nDone. Administrator provisioning finished; passwords were not logged.");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("\nSeed failed:", error);
  process.exitCode = 1;

  // Close the connection pool so the process can exit even when the failure
  // happened half-way through (for example on a constraint violation).
  const { prisma } = await import("../src/lib/db/prisma");
  await prisma.$disconnect().catch(() => {});
});
