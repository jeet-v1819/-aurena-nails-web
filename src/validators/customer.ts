/** Validation schemas for the customer-facing app. */
import { z } from "zod";
import { normaliseEmail, normaliseMobile } from "@/lib/utils";

/* ------------------------------------------------------------------ helpers */

const email = z
  .string()
  .trim()
  .min(1, "Email address is required.")
  .transform((value) => normaliseEmail(value))
  .pipe(z.email("Please enter a valid email address."));

/** Indian mobile numbers: 10 digits starting 6-9, optionally +91 / 0 prefixed. */
const mobile = z
  .string()
  .trim()
  .min(1, "Mobile number is required.")
  .transform((value) => normaliseMobile(value) ?? value)
  .refine((value) => /^\+91[6-9]\d{9}$/.test(value), "Please enter a valid mobile number.");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(72, "Password is too long.")
  .refine((value) => new TextEncoder().encode(value).byteLength <= 72, "Password is too long.")
  .regex(/[a-z]/, "Include at least one lowercase letter.")
  .regex(/[A-Z]/, "Include at least one uppercase letter.")
  .regex(/\d/, "Include at least one number.");

/* --------------------------------------------------------------- auth forms */

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(2, "First name must be at least 2 characters.").max(60),
    lastName: z.string().trim().min(1, "Last name is required.").max(60),
    email,
    mobile,
    password,
    confirmPassword: z.string(),
    /** Optional Cloudinary URL produced by the upload widget. */
    avatarUrl: z.string().trim().optional().or(z.literal("")),
    avatarPublicId: z.string().trim().optional().or(z.literal("")),
    acceptTerms: z
      .union([z.literal("on"), z.literal("true"), z.boolean()])
      .refine((accepted) => accepted === true || accepted === "on" || accepted === "true", "Please accept before continuing."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  /** Email address *or* mobile number. */
  identifier: z.string().trim().min(3, "Enter your email address or mobile number."),
  password: z.string().min(1, "Password is required."),
  remember: z.union([z.literal("on"), z.literal("true"), z.boolean()]).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(10, "This reset link is invalid."),
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/* ------------------------------------------------------------ account forms */

export const profileSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters.").max(60),
  lastName: z.string().trim().min(1, "Last name is required.").max(60),
  mobile,
  avatarUrl: z.string().trim().optional().or(z.literal("")),
  avatarPublicId: z.string().trim().optional().or(z.literal("")),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: "Choose a password you have not used before.",
    path: ["password"],
  });

/* -------------------------------------------------------------- booking form */

export const bookingSchema = z.object({
  serviceId: z.string().trim().min(1, "Please choose a service."),
  /** YYYY-MM-DD */
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid date."),
  startMinutes: z.coerce
    .number()
    .int("Please choose an available time slot.")
    .min(0)
    .max(24 * 60 - 1),
  /** Optional note for the nail artist. */
  customerNote: z.string().trim().max(500, "Please keep the note under 500 characters.").optional().or(z.literal("")),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export const cancelAppointmentSchema = z.object({
  appointmentId: z.string().trim().min(1),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
});

/* --------------------------------------------------------------- review form */

export const reviewSchema = z.object({
  serviceId: z.string().trim().min(1, "Missing service."),
  rating: z.coerce
    .number()
    .int("Choose a rating between 1 and 5 stars.")
    .min(1, "Choose a rating between 1 and 5 stars.")
    .max(5, "Choose a rating between 1 and 5 stars."),
  comment: z
    .string()
    .trim()
    .min(10, "Please share at least a few words about your experience.")
    .max(1000, "Please keep your review under 1000 characters."),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

/* -------------------------------------------------------------- contact form */

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(80),
  email,
  mobile: z
    .string()
    .trim()
    .min(1, "Mobile number is required.")
    .transform((value) => normaliseMobile(value) ?? value)
    .refine((value) => /^\+91[6-9]\d{9}$/.test(value), "Please enter a valid mobile number."),
  subject: z.string().trim().min(3, "Please add a subject.").max(120),
  message: z.string().trim().min(10, "Please write at least a short message.").max(2000),
});

export type ContactInput = z.infer<typeof contactSchema>;

/* ------------------------------------------------------------------ wishlist */

export const wishlistItemSchema = z
  .object({
    serviceId: z.string().trim().min(1).optional().or(z.literal("")),
    galleryImageId: z.string().trim().min(1).optional().or(z.literal("")),
  })
  .refine((data) => Boolean(data.serviceId) !== Boolean(data.galleryImageId), {
    message: "A wishlist item must reference exactly one service or design.",
  });
