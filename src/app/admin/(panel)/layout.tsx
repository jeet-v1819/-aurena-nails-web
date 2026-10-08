import { requireAdmin } from "@/lib/auth/session";
import { countUnreadMessages } from "@/server/services/messages";
import { getDashboardStats } from "@/server/services/dashboard";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  // Authoritative guard: re-reads the admin from the database on every request.
  const admin = await requireAdmin();

  const [unreadMessages, stats] = await Promise.all([countUnreadMessages(), getDashboardStats()]);

  return (
    <AdminShell
      adminName={`${admin.firstName} ${admin.lastName}`.trim()}
      unreadMessages={unreadMessages}
      pendingAppointments={stats.appointments.pending}
    >
      {children}
    </AdminShell>
  );
}
