/** Branded email bodies, kept next to the mailer so wording stays consistent. */
import { APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatMinutes } from "@/lib/format";
import type { AppointmentStatus } from "@prisma/client";
import { emailButton, emailLayout } from "./mailer";

export function passwordResetEmail(name: string, link: string, expiresMinutes: number) {
  return {
    subject: "Reset your Aurena Nails password",
    html: emailLayout(
      "Password reset request",
      `<p>Hi ${name},</p>
       <p>We received a request to reset the password for your Aurena Nails account.
       This link expires in ${expiresMinutes} minutes and can be used once.</p>
       ${emailButton(link, "Create a new password")}
       <p style="font-size:13px;color:#7c6f73;">If you did not request this, you can safely ignore this email — your password will not change.</p>`
    ),
    text: `Hi ${name},

We received a request to reset your Aurena Nails password.

Open this link to choose a new password (valid for ${expiresMinutes} minutes, single use):
${link}

If you did not request this, you can ignore this email.`,
  };
}

export function welcomeEmail(name: string, appUrl: string) {
  return {
    subject: "Welcome to Aurena Nails",
    html: emailLayout(
      `Welcome, ${name}!`,
      `<p>Your Aurena Nails account is ready.</p>
       <p>You can now book appointments, keep a wishlist of designs you love and review your visits.</p>
       ${emailButton(`${appUrl}/booking`, "Book your first appointment")}`
    ),
    text: `Welcome to Aurena Nails, ${name}!

Your account is ready. Book your first appointment at ${appUrl}/booking`,
  };
}

export function appointmentStatusEmail(params: {
  customerName: string;
  status: AppointmentStatus;
  serviceName: string;
  date: Date;
  startMinutes: number;
  reference: string;
  adminNote?: string | null;
  appUrl: string;
}) {
  const { customerName, status, serviceName, date, startMinutes, reference, adminNote, appUrl } = params;
  const when = `${formatDate(date, { weekday: "long", day: "numeric", month: "long" })} at ${formatMinutes(startMinutes)}`;

  const headline: Record<AppointmentStatus, string> = {
    PENDING: "Appointment request received",
    CONFIRMED: "Your appointment is confirmed",
    COMPLETED: "Thank you for visiting",
    CANCELLED: "Your appointment was cancelled",
    REJECTED: "We could not accept that slot",
  };

  return {
    subject: `${headline[status]} — ${serviceName}`,
    html: emailLayout(
      headline[status],
      `<p>Hi ${customerName},</p>
       <p><strong>${serviceName}</strong><br/>${when}<br/>Booking reference: <strong>${reference}</strong></p>
       <p>Status: <strong>${APPOINTMENT_STATUS_LABELS[status]}</strong></p>
       ${adminNote ? `<p style="background:#fbf7f4;border-radius:12px;padding:12px 16px;font-size:14px;"><em>${adminNote}</em></p>` : ""}
       ${emailButton(`${appUrl}/appointments`, "View my appointments")}`
    ),
    text: `${headline[status]}

${serviceName}
${when}
Booking reference: ${reference}
Status: ${APPOINTMENT_STATUS_LABELS[status]}
${adminNote ? `Note from the studio: ${adminNote}` : ""}

Manage your appointments: ${appUrl}/appointments`,
  };
}

export function deactivatedAccountEmail(name: string) {
  return {
    subject: "Your Aurena Nails account has been deactivated",
    html: emailLayout(
      "Account deactivated",
      `<p>Hi ${name},</p>
       <p>Your Aurena Nails account has been deactivated by the studio. You will not be able to sign in while it is inactive.</p>
       <p>Please contact Aurena Nails if you believe this was a mistake.</p>`
    ),
    text: `Hi ${name},

Your Aurena Nails account has been deactivated. Please contact the studio if you believe this was a mistake.`,
  };
}
