/**
 * Website content + studio settings.
 *
 * `WebsiteContent` stores key/value rows; every key has a default in
 * `src/lib/content/defaults.ts`, so the site renders correctly on a brand new
 * database and the admin only ever stores overrides.
 */
import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { CONTENT_DEFAULTS, CONTENT_FIELDS, type SiteContent } from "@/lib/content/defaults";
import {
  DEFAULT_CANCELLATION_WINDOW_HOURS,
  DEFAULT_MAX_ADVANCE_DAYS,
  DEFAULT_MIN_LEAD_MINUTES,
  DEFAULT_SLOT_INTERVAL_MINUTES,
} from "@/lib/constants";

const number = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Merges stored values over the code defaults and exposes typed accessors. */
function resolve(stored: Record<string, string>): SiteContent {
  const values: Record<string, string> = { ...CONTENT_DEFAULTS };

  for (const field of CONTENT_FIELDS) {
    const value = stored[field.key];
    if (value !== undefined && value !== null && value !== "") values[field.key] = value;
  }

  return {
    values,
    text: (key: string) => values[key] ?? "",

    siteName: values["site.name"],
    tagline: values["site.tagline"],
    seoDescription: values["site.seoDescription"],
    footerNote: values["site.footerNote"],

    heroEyebrow: values["home.hero.eyebrow"],
    heroTitle: values["home.hero.title"],
    heroDescription: values["home.hero.description"],
    heroImage: values["home.hero.image"],
    heroPrimaryCta: values["home.hero.primaryCta"],
    heroSecondaryCta: values["home.hero.secondaryCta"],
    servicesTitle: values["home.services.title"],
    servicesDescription: values["home.services.description"],
    galleryTitle: values["home.gallery.title"],
    galleryDescription: values["home.gallery.description"],
    aboutTitle: values["home.about.title"],
    aboutDescription: values["home.about.description"],
    aboutImage: values["home.about.image"],

    aboutPageTitle: values["about.title"],
    aboutIntro: values["about.intro"],
    story: values["about.story"],
    mission: values["about.mission"],
    vision: values["about.vision"],
    whyUs: values["about.whyUs"]
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    artistName: values["about.artistName"],
    artistBio: values["about.artistBio"],
    aboutImage1: values["about.image1"],
    aboutImage2: values["about.image2"],
    aboutCtaTitle: values["about.ctaTitle"],

    phone: values["contact.phone"],
    whatsapp: values["contact.whatsapp"],
    email: values["contact.email"],
    address: values["contact.address"],
    mapEmbedUrl: values["contact.mapEmbedUrl"],
    hoursNote: values["contact.hoursNote"],

    instagram: values["social.instagram"],
    facebook: values["social.facebook"],
    pinterest: values["social.pinterest"],
    youtube: values["social.youtube"],
    whatsappMessage: values["social.whatsappMessage"],

    bookingNote: values["booking.note"],
    bookingConfirmationNote: values["booking.confirmationNote"],
    slotIntervalMinutes: number(values["booking.slotIntervalMinutes"], DEFAULT_SLOT_INTERVAL_MINUTES),
    minLeadMinutes: number(values["booking.minLeadMinutes"], DEFAULT_MIN_LEAD_MINUTES),
    maxAdvanceDays: number(values["booking.maxAdvanceDays"], DEFAULT_MAX_ADVANCE_DAYS),
    cancellationWindowHours: number(
      values["booking.cancellationWindowHours"] === "0" ? "0" : values["booking.cancellationWindowHours"],
      DEFAULT_CANCELLATION_WINDOW_HOURS
    ),
    bufferMinutes: number(values["booking.bufferMinutes"] === "0" ? "0" : values["booking.bufferMinutes"], 15),
  };
}

/** Resolved content for the current request (deduplicated by React `cache`). */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  try {
    const rows = await prisma.websiteContent.findMany({ select: { key: true, value: true } });
    return resolve(Object.fromEntries(rows.map((row) => [row.key, row.value])));
  } catch (error) {
    // A missing table (fresh clone before migrations) must not take the site down.
    console.error("[content] falling back to defaults:", error);
    return resolve({});
  }
});

/** Raw key/value map for the admin editor. */
export async function getContentMap(): Promise<Record<string, string>> {
  const rows = await prisma.websiteContent.findMany({ select: { key: true, value: true } });
  return { ...CONTENT_DEFAULTS, ...Object.fromEntries(rows.map((row) => [row.key, row.value])) };
}

/** Persists admin edits (upsert per key). */
export async function updateContent(values: Record<string, string>) {
  const known = new Map(CONTENT_FIELDS.map((field) => [field.key, field]));

  await prisma.$transaction(
    Object.entries(values)
      .filter(([key]) => known.has(key))
      .map(([key, value]) =>
        prisma.websiteContent.upsert({
          where: { key },
          create: {
            key,
            value: value ?? "",
            section: known.get(key)!.section,
            label: known.get(key)!.label,
          },
          update: { value: value ?? "" },
        })
      )
  );
}

/** Booking rules, read straight from content so both agree by construction. */
export async function getBookingSettings() {
  const content = await getSiteContent();
  return {
    slotIntervalMinutes: content.slotIntervalMinutes,
    minLeadMinutes: content.minLeadMinutes,
    maxAdvanceDays: content.maxAdvanceDays,
    cancellationWindowHours: content.cancellationWindowHours,
    bufferMinutes: content.bufferMinutes,
  };
}
