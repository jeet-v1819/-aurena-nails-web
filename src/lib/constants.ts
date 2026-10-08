/**
 * Shared constants: statuses, labels, pagination and configuration defaults.
 * Keeping them in one place stops string literals from spreading across the app.
 */
import type { AppointmentStatus, CategoryType, NotificationType, Role } from "@prisma/client";

export const APP_NAME = "Aurena Nails";
export const APP_TAGLINE = "Luxury Nail Art & Beauty Experience";

export const ROLES: Record<Role, string> = {
  ADMIN: "Administrator",
  CUSTOMER: "Customer",
};

export const CATEGORY_TYPES: Record<CategoryType, string> = {
  SERVICE: "Service",
  GALLERY: "Gallery",
  VIDEO: "Video",
};

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

/** Tailwind class names per status (badge styling). */
export const APPOINTMENT_STATUS_STYLES: Record<AppointmentStatus, string> = {
  PENDING: "badge-warning",
  CONFIRMED: "badge-success",
  COMPLETED: "badge-rose",
  CANCELLED: "badge-muted",
  REJECTED: "badge-danger",
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  ACCOUNT: "Account",
  APPOINTMENT: "Appointment",
  REVIEW: "Review",
  MESSAGE: "Message",
  SYSTEM: "System",
};

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Pagination */
export const PAGE_SIZE = 12;
export const ADMIN_PAGE_SIZE = 15;

/** Media rules (mirrored by the upload API so the client cannot bypass them). */
export const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
export const VIDEO_MAX_BYTES = 60 * 1024 * 1024; // 60 MB
export const MAX_IMAGE_COUNT_PER_UPLOAD = 12;

/** Booking configuration defaults — the admin can override every one of these. */
export const DEFAULT_SLOT_INTERVAL_MINUTES = 30;
export const DEFAULT_MIN_LEAD_MINUTES = 120; // must book at least 2h ahead
export const DEFAULT_MAX_ADVANCE_DAYS = 90;
export const DEFAULT_CANCELLATION_WINDOW_HOURS = 12;

/** Service facets used by the filters and the admin forms. */
export const NAIL_TYPES = ["Natural", "Gel", "Acrylic", "Builder Gel", "Polygel", "Press-on"] as const;
export const SERVICE_STYLES = ["Minimal", "French", "Ombre", "Chrome", "Abstract", "3D Art", "Glitter", "Marble"] as const;
export const OCCASIONS = ["Bridal", "Party", "Casual", "Office", "Festive", "Anniversary"] as const;
export const DIFFICULTIES = ["Easy", "Moderate", "Advanced", "Master"] as const;

/** WhatsApp deep link used by the floating button and the contact page. */
export function whatsappLink(mobileE164: string, message: string) {
  const number = mobileE164.replace(/[^\d]/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export const WHATSAPP_DEFAULT_MESSAGE = `Hello ${APP_NAME}, I would like to book an appointment.`;
