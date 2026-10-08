import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Heart, Star } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/server/services/users";
import { countCustomerAppointments } from "@/server/services/bookings";
import { countWishlistItems } from "@/server/services/wishlist";
import { ProfileForm } from "@/components/customer/profile-form";
import { StatPill } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "My Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const session = await requireUser("/profile");
  const [profile, appointments, wishlistCount] = await Promise.all([
    getProfile(session.id),
    countCustomerAppointments(session.id),
    countWishlistItems(session.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatPill label="Appointments" value={appointments.total} />
        <StatPill label="Upcoming" value={appointments.upcoming} />
        <StatPill label="Completed visits" value={appointments.completed} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream-deep px-5 py-4 text-sm">
        <p className="text-muted">
          Member since {profile ? formatDate(profile.createdAt) : "—"}
          {profile?.lastLoginAt ? ` · Last signed in ${formatDate(profile.lastLoginAt)}` : ""}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/appointments" className="inline-flex items-center gap-1.5 text-rosegold-dark">
            <CalendarCheck size={15} /> My appointments
          </Link>
          <Link href="/wishlist" className="inline-flex items-center gap-1.5 text-rosegold-dark">
            <Heart size={15} /> Wishlist ({wishlistCount})
          </Link>
          <Link href="/reviews" className="hidden items-center gap-1.5 text-rosegold-dark">
            <Star size={15} /> Reviews
          </Link>
        </div>
      </div>

      <ProfileForm
        customer={{
          firstName: session.firstName,
          lastName: session.lastName,
          email: session.email,
          mobile: session.mobile,
          avatarUrl: session.avatarUrl,
          avatarPublicId: profile?.avatarPublicId ?? null,
        }}
      />
    </div>
  );
}
