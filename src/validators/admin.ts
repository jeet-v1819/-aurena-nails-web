/**
 * Validation schemas for the admin panel (catalogue, content, studio settings).
 */
import { z } from "zod";
import { CATEGORY_TYPES, DIFFICULTIES, NAIL_TYPES, OCCASIONS, SERVICE_STYLES } from "@/lib/constants";
import { slugify } from "@/lib/format";
import { normaliseEmail, normaliseMobile, parseTags } from "@/lib/utils";
import { dateOnlyFromString } from "@/lib/time";
import { CONTENT_FIELDS } from "@/lib/content/defaults";

const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters.`)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined));

const inputBoolean = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "on", "yes"].includes(normalized)) return true;
    if (["false", "0", "off", "no", ""].includes(normalized)) return false;
  }
  if (value === 1) return true;
  if (value === 0) return false;
  return value;
}, z.boolean());

/** Accepts "1299", "1299.50" or "" and returns a number or undefined. */
const optionalMoney = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const number = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
    return Number.isFinite(number) ? number : NaN;
  })
  .refine((value) => value === undefined || (Number.isFinite(value) && value >= 0), {
    message: "Enter a valid amount.",
  });

const slugField = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? slugify(value) : ""))
  .refine((value) => value === "" || value.length >= 2, "Slug must be at least 2 characters.");

/* ------------------------------------------------------------------ services */

export const serviceSchema = z.object({
  name: z.string().trim().min(3, "Service name must be at least 3 characters.").max(120),
  slug: slugField,
  shortDescription: z.string().trim().min(10, "Short description must be at least 10 characters.").max(300),
  description: z.string().trim().min(20, "Full description must be at least 20 characters."),
  categoryId: z.string().trim().min(1, "Please choose a category."),
  durationMinutes: z.coerce
    .number()
    .int("Duration must be a whole number of minutes.")
    .min(15, "Duration must be at least 15 minutes.")
    .max(600, "Duration cannot exceed 10 hours."),
  startingPrice: optionalMoney,
  regularPrice: optionalMoney,
  promoPrice: optionalMoney,
  currency: z.string().trim().length(3).default("INR"),
  nailType: z.enum(NAIL_TYPES).optional().or(z.literal("")).transform((value) => (value ? value : undefined)),
  style: z.enum(SERVICE_STYLES).optional().or(z.literal("")).transform((value) => (value ? value : undefined)),
  occasion: z.enum(OCCASIONS).optional().or(z.literal("")).transform((value) => (value ? value : undefined)),
  difficulty: z.enum(DIFFICULTIES).optional().or(z.literal("")).transform((value) => (value ? value : undefined)),
  preparationInstructions: optionalText(4000),
  afterCareInstructions: optionalText(4000),
  isActive: inputBoolean.default(true),
  isFeatured: inputBoolean.default(false),
  isAvailable: inputBoolean.default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

/* ---------------------------------------------------------------- categories */

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required.").max(80),
  slug: slugField,
  type: z.enum(CATEGORY_TYPES as unknown as [string, ...string[]]).default("SERVICE"),
  description: optionalText(600),
  imageUrl: z.string().trim().optional().or(z.literal("")),
  imagePublicId: z.string().trim().optional().or(z.literal("")),
  isActive: inputBoolean.default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

/* -------------------------------------------------------------- gallery */

export const galleryImageSchema = z.object({
  title: z.string().trim().min(2, "Please give this design a title.").max(140),
  description: optionalText(1000),
  categoryId: z.string().trim().min(1, "Please choose a category."),
  url: z.string().trim().min(1, "Upload an image before saving."),
  publicId: z.string().trim().optional().or(z.literal("")),
  alt: optionalText(200),
  width: z.coerce.number().int().optional(),
  height: z.coerce.number().int().optional(),
  fileSize: z.coerce.number().int().optional(),
  format: z.string().trim().optional().or(z.literal("")),
  tags: z.union([z.string(), z.array(z.string())]).optional().transform((value) => parseTags(value)),
  style: optionalText(60),
  occasion: optionalText(60),
  designDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
  isFeatured: inputBoolean.default(false),
  isActive: inputBoolean.default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

/* ------------------------------------------------------------------ videos */

export const videoSchema = z.object({
  title: z.string().trim().min(2, "Please give this video a title.").max(140),
  description: optionalText(1000),
  categoryId: z.string().trim().min(1, "Please choose a category."),
  url: z.string().trim().min(1, "Upload a video before saving."),
  publicId: z.string().trim().optional().or(z.literal("")),
  thumbnailUrl: z.string().trim().optional().or(z.literal("")),
  thumbnailPublicId: z.string().trim().optional().or(z.literal("")),
  durationSeconds: z.coerce.number().int().min(0).optional(),
  width: z.coerce.number().int().optional(),
  height: z.coerce.number().int().optional(),
  fileSize: z.coerce.number().int().optional(),
  format: z.string().trim().optional().or(z.literal("")),
  tags: z.union([z.string(), z.array(z.string())]).optional().transform((value) => parseTags(value)),
  isFeatured: inputBoolean.default(false),
  isActive: inputBoolean.default(true),
});

/* ----------------------------------------------------- customers (admin) */

export const adminCustomerSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required.").max(60),
  lastName: z.string().trim().min(1, "Last name is required.").max(60),
  email: z
    .string()
    .trim()
    .transform((value) => normaliseEmail(value))
    .pipe(z.email("Please enter a valid email address.")),
  mobile: z
    .string()
    .trim()
    .transform((value) => normaliseMobile(value) ?? value)
    .refine((value) => /^\+91[6-9]\d{9}$/.test(value), "Please enter a valid mobile number."),
  isActive: inputBoolean.default(true),
});

/* -------------------------------------------------- appointments (admin) */

export const appointmentStatusSchema = z.object({
  appointmentId: z.string().trim().min(1),
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "REJECTED"]),
  adminNote: optionalText(600),
});

/* -------------------------------------------------------- business hours */

export const businessHoursSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    isOpen: inputBoolean.default(true),
    openMinutes: z.coerce.number().int().min(0).max(24 * 60),
    closeMinutes: z.coerce.number().int().min(0).max(24 * 60),
    breakStartMinutes: z.coerce.number().int().min(0).max(24 * 60).optional(),
    breakEndMinutes: z.coerce.number().int().min(0).max(24 * 60).optional(),
    slotIntervalMinutes: z.coerce.number().int().min(5).max(240).optional(),
    note: optionalText(200),
  })
  .superRefine((day, context) => {
    if (day.closeMinutes <= day.openMinutes) {
      context.addIssue({ code: "custom", path: ["closeMinutes"], message: "Closing time must be after opening time." });
    }

    const hasBreakStart = day.breakStartMinutes !== undefined;
    const hasBreakEnd = day.breakEndMinutes !== undefined;
    if (hasBreakStart !== hasBreakEnd) {
      context.addIssue({
        code: "custom",
        path: [hasBreakStart ? "breakEndMinutes" : "breakStartMinutes"],
        message: "Enter both break times or leave both blank.",
      });
    } else if (hasBreakStart && hasBreakEnd) {
      const breakStart = day.breakStartMinutes!;
      const breakEnd = day.breakEndMinutes!;
      if (breakEnd <= breakStart) {
        context.addIssue({ code: "custom", path: ["breakEndMinutes"], message: "Break end must be after break start." });
      }
      if (day.isOpen && (breakStart < day.openMinutes || breakEnd > day.closeMinutes)) {
        context.addIssue({ code: "custom", path: ["breakStartMinutes"], message: "The break must fall within opening hours." });
      }
    }
  });

export const businessHoursListSchema = z
  .array(businessHoursSchema)
  .length(7, "All seven days must be configured.")
  .superRefine((days, context) => {
    const seen = new Set<number>();
    days.forEach((day, index) => {
      if (seen.has(day.dayOfWeek)) {
        context.addIssue({ code: "custom", path: [index, "dayOfWeek"], message: "Each weekday must appear only once." });
      }
      seen.add(day.dayOfWeek);
    });
    if (seen.size !== 7) {
      context.addIssue({ code: "custom", path: [], message: "All seven unique weekdays must be configured." });
    }
  });

/* --------------------------------------------------------------- holidays */

export const holidaySchema = z.object({
  name: z.string().trim().min(2, "Please name the holiday.").max(120),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid date.")
    .refine((value) => dateOnlyFromString(value) !== null, "Please choose a real calendar date."),
  description: optionalText(400),
  isActive: inputBoolean.default(true),
});

/* -------------------------------------------------------- content settings */

const CONTENT_NUMBER_BOUNDS: Record<string, { min: number; max: number }> = {
  "booking.slotIntervalMinutes": { min: 5, max: 240 },
  "booking.minLeadMinutes": { min: 0, max: 10_080 },
  "booking.maxAdvanceDays": { min: 1, max: 365 },
  "booking.cancellationWindowHours": { min: 0, max: 720 },
  "booking.bufferMinutes": { min: 0, max: 240 },
};

export const contentUpdateSchema = z
  .record(z.string().trim().max(8000), z.string().trim().max(8000))
  .superRefine((values, context) => {
    for (const field of CONTENT_FIELDS) {
      const value = values[field.key];
      if (value === undefined || value === "") continue;

      if (field.type === "number") {
        const bounds = CONTENT_NUMBER_BOUNDS[field.key];
        const parsed = Number(value);
        if (!bounds || !/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(parsed) || parsed < bounds.min || parsed > bounds.max) {
          context.addIssue({ code: "custom", path: [field.key], message: "Enter a whole number within the allowed range." });
        }
      } else if (field.type === "email" && !z.email().safeParse(value).success) {
        context.addIssue({ code: "custom", path: [field.key], message: "Enter a valid email address." });
      } else if (field.type === "url") {
        try {
          const url = new URL(value);
          if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Invalid URL scheme");
        } catch {
          context.addIssue({ code: "custom", path: [field.key], message: "Enter a valid HTTP or HTTPS URL." });
        }
      } else if (field.type === "image") {
        const isLocalPath = value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
        let isTrustedHttps = false;
        try {
          const url = new URL(value);
          isTrustedHttps = url.protocol === "https:" && ["res.cloudinary.com", "images.unsplash.com"].includes(url.hostname);
        } catch {
          // Relative local paths are allowed; all other malformed values fail below.
        }
        if (!isLocalPath && !isTrustedHttps) {
          context.addIssue({ code: "custom", path: [field.key], message: "Use a local image path or a trusted HTTPS image URL." });
        }
      } else if (field.type === "tel" && !/^[+0-9()\s-]+$/.test(value)) {
        context.addIssue({ code: "custom", path: [field.key], message: "Enter a valid phone number." });
      }
    }
  });

export const settingsSchema = z.object({
  siteName: z.string().trim().min(2).max(80),
  tagline: z.string().trim().min(2).max(160),
  seoDescription: z.string().trim().min(10).max(300),
  footerNote: z.string().trim().max(400).optional().or(z.literal("")),
  slotIntervalMinutes: z.coerce.number().int().min(5).max(240),
  minLeadMinutes: z.coerce.number().int().min(0).max(10_080),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  cancellationWindowHours: z.coerce.number().int().min(0).max(720),
  bufferMinutes: z.coerce.number().int().min(0).max(240),
});

/* --------------------------------------------------------------- reviews */

export const reviewModerationSchema = z.object({
  reviewId: z.string().trim().min(1),
  action: z.enum(["hide", "show", "delete", "note"]),
  adminNote: optionalText(400),
});
