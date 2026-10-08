/**
 * Editable website content: single source of truth for the admin "Website
 * content" screen *and* the runtime defaults.
 *
 * Values live in the `WebsiteContent` table (key/value). Anything the admin has
 * not changed falls back to the default declared here, so the site always
 * renders — a fresh database is never blank.
 */
import { DEFAULT_CANCELLATION_WINDOW_HOURS, DEFAULT_MAX_ADVANCE_DAYS, DEFAULT_MIN_LEAD_MINUTES, DEFAULT_SLOT_INTERVAL_MINUTES } from "@/lib/constants";

export type ContentFieldType = "text" | "textarea" | "image" | "url" | "tel" | "email" | "number";

export type ContentField = {
  key: string;
  section: ContentSection;
  label: string;
  type: ContentFieldType;
  default: string;
  help?: string;
};

export const CONTENT_SECTION_TITLES = {
  site: "Site identity & SEO",
  home: "Home page",
  about: "About page",
  contact: "Contact details",
  social: "Social media",
  booking: "Booking rules",
} as const;

export type ContentSection = keyof typeof CONTENT_SECTION_TITLES;

export const CONTENT_FIELDS: ContentField[] = [
  /* ------------------------------------------------------------- site */
  { key: "site.name", section: "site", label: "Site name", type: "text", default: "Aurena Nails" },
  {
    key: "site.tagline",
    section: "site",
    label: "Tagline",
    type: "text",
    default: "Luxury Nail Art & Beauty Experience",
  },
  {
    key: "site.seoDescription",
    section: "site",
    label: "Meta description",
    type: "textarea",
    default:
      "Aurena Nails is a luxury nail art studio offering gel, acrylic, French, bridal and custom nail art. Book your appointment online.",
    help: "Shown by search engines under the page title (150–160 characters is ideal).",
  },
  {
    key: "site.footerNote",
    section: "site",
    label: "Footer note",
    type: "textarea",
    default: "Handcrafted nail art, designed around you — every set is created with patience, precision and care.",
  },

  /* ------------------------------------------------------------- home */
  { key: "home.hero.eyebrow", section: "home", label: "Hero eyebrow", type: "text", default: "Luxury nail studio" },
  { key: "home.hero.title", section: "home", label: "Hero title", type: "text", default: "Beautiful Nails. Beautiful You." },
  {
    key: "home.hero.description",
    section: "home",
    label: "Hero description",
    type: "textarea",
    default: "Discover elegant nail art designed to make every moment special.",
  },
  { key: "home.hero.image", section: "home", label: "Hero image", type: "image", default: "/seed/hero-nails.jpg" },
  { key: "home.hero.primaryCta", section: "home", label: "Primary button text", type: "text", default: "Book Appointment" },
  {
    key: "home.hero.secondaryCta",
    section: "home",
    label: "Secondary button text",
    type: "text",
    default: "Explore Nail Art",
  },
  {
    key: "home.services.title",
    section: "home",
    label: "Featured services heading",
    type: "text",
    default: "Signature Nail Services",
  },
  {
    key: "home.services.description",
    section: "home",
    label: "Featured services description",
    type: "textarea",
    default: "From everyday minimal sets to full bridal glamour — each service is tailored to your hands and your story.",
  },
  {
    key: "home.gallery.title",
    section: "home",
    label: "Gallery heading",
    type: "text",
    default: "Nail Art We Are Proud Of",
  },
  {
    key: "home.gallery.description",
    section: "home",
    label: "Gallery description",
    type: "textarea",
    default: "A glimpse of recent designs created at the studio — filter the full gallery by style and occasion.",
  },
  {
    key: "home.about.title",
    section: "home",
    label: "About teaser heading",
    type: "text",
    default: "A Studio Built On Detail",
  },
  {
    key: "home.about.description",
    section: "home",
    label: "About teaser text",
    type: "textarea",
    default:
      "Aurena Nails began with one belief: beautiful nails should feel calm, considered and completely personal. Every appointment is unhurried, hygienic and finished to a mirror shine.",
  },
  { key: "home.about.image", section: "home", label: "About teaser image", type: "image", default: "/seed/studio-1.jpg" },

  /* ------------------------------------------------------------ about */
  { key: "about.title", section: "about", label: "Page title", type: "text", default: "The Aurena Story" },
  {
    key: "about.intro",
    section: "about",
    label: "Intro line",
    type: "textarea",
    default: "A small studio with a big obsession: nails that look flawless and feel like you.",
  },
  {
    key: "about.story",
    section: "about",
    label: "Our story",
    type: "textarea",
    default:
      "Aurena Nails started as a single chair, a ring light and a sketchbook full of designs. Clients came for a set of nails and stayed for the calm — the music low, the tools sterilised, and no rush to be anywhere else.\n\nToday the studio has grown, but the ritual has not changed. Every appointment begins with a conversation about your hands, your routine and the occasion. We then build a set that lasts — properly prepped, gently shaped and finished with a gloss that catches the light.",
  },
  {
    key: "about.mission",
    section: "about",
    label: "Mission",
    type: "textarea",
    default:
      "To make premium nail care feel personal and unhurried, using salon-grade products, sterilised tools and designs drawn for each client.",
  },
  {
    key: "about.vision",
    section: "about",
    label: "Vision",
    type: "textarea",
    default:
      "To be the studio people recommend when they want nail art that is elegant, long-lasting and unmistakably theirs.",
  },
  {
    key: "about.whyUs",
    section: "about",
    label: "Why choose us (one per line)",
    type: "textarea",
    default:
      "Certified nail technicians with 8+ years of experience\nHospital-grade sterilisation for every tool\nPremium gel systems that last 3–4 weeks\nFree design consultation before every appointment\nCruelty-free, vegan-friendly products\nUnhurried appointments — never double booked",
  },
  { key: "about.artistName", section: "about", label: "Lead artist name", type: "text", default: "Aurena Shah" },
  {
    key: "about.artistBio",
    section: "about",
    label: "Lead artist bio",
    type: "textarea",
    default:
      "Trained in structured gel and Russian manicure techniques, Aurena has spent nearly a decade painting tiny details that make a big difference. Bridal sets are her specialty.",
  },
  { key: "about.image1", section: "about", label: "Studio image 1", type: "image", default: "/seed/studio-1.jpg" },
  { key: "about.image2", section: "about", label: "Studio image 2", type: "image", default: "/seed/studio-2.jpg" },
  {
    key: "about.ctaTitle",
    section: "about",
    label: "Closing call-to-action",
    type: "text",
    default: "Ready for your next set?",
  },

  /* ---------------------------------------------------------- contact */
  { key: "contact.phone", section: "contact", label: "Phone (display)", type: "tel", default: "+91 98200 45678" },
  {
    key: "contact.whatsapp",
    section: "contact",
    label: "WhatsApp number",
    type: "tel",
    default: "+919820045678",
    help: "Digits only with country code, e.g. 919820045678.",
  },
  { key: "contact.email", section: "contact", label: "Email address", type: "email", default: "hello@aurenanails.com" },
  {
    key: "contact.address",
    section: "contact",
    label: "Studio address",
    type: "textarea",
    default: "2nd Floor, Rose Court, Linking Road, Bandra West, Mumbai 400050",
  },
  {
    key: "contact.mapEmbedUrl",
    section: "contact",
    label: "Google Maps embed URL",
    type: "url",
    default:
      "https://www.google.com/maps?q=Linking%20Road%2C%20Bandra%20West%2C%20Mumbai&output=embed",
    help: "Google Maps → Share → Embed a map → copy the src URL only.",
  },
  {
    key: "contact.hoursNote",
    section: "contact",
    label: "Opening hours note",
    type: "textarea",
    default: "Appointments are by prior booking so every client gets an unhurried slot.",
  },

  /* ----------------------------------------------------------- social */
  { key: "social.instagram", section: "social", label: "Instagram URL", type: "url", default: "https://instagram.com/" },
  { key: "social.facebook", section: "social", label: "Facebook URL", type: "url", default: "https://facebook.com/" },
  { key: "social.pinterest", section: "social", label: "Pinterest URL", type: "url", default: "https://pinterest.com/" },
  { key: "social.youtube", section: "social", label: "YouTube URL", type: "url", default: "https://youtube.com/" },
  {
    key: "social.whatsappMessage",
    section: "social",
    label: "WhatsApp prefilled message",
    type: "textarea",
    default: "Hello Aurena Nails, I would like to book an appointment.",
  },

  /* ---------------------------------------------------------- booking */
  {
    key: "booking.note",
    section: "booking",
    label: "Booking page note",
    type: "textarea",
    default: "Choose a service, pick a time that suits you and we will confirm your appointment shortly.",
  },
  {
    key: "booking.confirmationNote",
    section: "booking",
    label: "After-booking message",
    type: "textarea",
    default: "Your request has been received. We will confirm it by email and in your notifications.",
  },
  {
    key: "booking.slotIntervalMinutes",
    section: "booking",
    label: "Slot interval (minutes)",
    type: "number",
    default: String(DEFAULT_SLOT_INTERVAL_MINUTES),
  },
  {
    key: "booking.minLeadMinutes",
    section: "booking",
    label: "Minimum notice (minutes)",
    type: "number",
    default: String(DEFAULT_MIN_LEAD_MINUTES),
    help: "How far in advance a customer must book.",
  },
  {
    key: "booking.maxAdvanceDays",
    section: "booking",
    label: "Book up to (days ahead)",
    type: "number",
    default: String(DEFAULT_MAX_ADVANCE_DAYS),
  },
  {
    key: "booking.cancellationWindowHours",
    section: "booking",
    label: "Free cancellation window (hours)",
    type: "number",
    default: String(DEFAULT_CANCELLATION_WINDOW_HOURS),
    help: "Customers can cancel up to this many hours before their appointment.",
  },
  {
    key: "booking.bufferMinutes",
    section: "booking",
    label: "Clean-up buffer between clients (minutes)",
    type: "number",
    default: "15",
  },
];

export const CONTENT_DEFAULTS: Record<string, string> = Object.fromEntries(
  CONTENT_FIELDS.map((field) => [field.key, field.default])
);

export const CONTENT_FIELDS_BY_SECTION = CONTENT_FIELDS.reduce<Record<ContentSection, ContentField[]>>(
  (accumulator, field) => {
    (accumulator[field.section] ??= []).push(field);
    return accumulator;
  },
  {} as Record<ContentSection, ContentField[]>
);

/**
 * Typed, resolved content used by the public pages.
 *
 * `values` keeps every raw key/value pair (for the admin editor and any future
 * key), while the named fields are the ones the templates actually consume.
 * `text()` is the escape hatch for keys without a named field.
 */
export type SiteContent = {
  values: Record<string, string>;
  text: (key: string) => string;

  // site
  siteName: string;
  tagline: string;
  seoDescription: string;
  footerNote: string;

  // home
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  heroImage: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  servicesTitle: string;
  servicesDescription: string;
  galleryTitle: string;
  galleryDescription: string;
  aboutTitle: string;
  aboutDescription: string;
  aboutImage: string;

  // about page
  aboutPageTitle: string;
  aboutIntro: string;
  story: string;
  mission: string;
  vision: string;
  whyUs: string[];
  artistName: string;
  artistBio: string;
  aboutImage1: string;
  aboutImage2: string;
  aboutCtaTitle: string;

  // contact
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  mapEmbedUrl: string;
  hoursNote: string;

  // social
  instagram: string;
  facebook: string;
  pinterest: string;
  youtube: string;
  whatsappMessage: string;

  // booking
  bookingNote: string;
  bookingConfirmationNote: string;
  slotIntervalMinutes: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  cancellationWindowHours: number;
  bufferMinutes: number;
};
