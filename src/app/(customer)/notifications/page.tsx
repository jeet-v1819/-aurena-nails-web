import type { Metadata } from "next";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listNotifications } from "@/server/services/notifications";
import { EmptyState, Pagination } from "@/components/ui/primitives";
import { MarkAllReadButton, NotificationItemActions } from "@/components/customer/notification-actions";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";
import { parsePage } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ page?: string | string[] }>;

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const session = await requireUser("/notifications");
  const page = parsePage(Array.isArray(params.page) ? params.page[0] : params.page);

  const notifications = await listNotifications(session.id, { page, pageSize: 15 });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {notifications.unread > 0
            ? `${notifications.unread} unread of ${notifications.total}`
            : `${notifications.total} notification${notifications.total === 1 ? "" : "s"}`}
        </p>
        <MarkAllReadButton disabled={notifications.unread === 0} />
      </div>

      {notifications.items.length ? (
        <>
          <ul className="space-y-3">
            {notifications.items.map((notification) => (
              <li
                key={notification.id}
                className={cn(
                  "card flex items-start gap-4 p-4",
                  !notification.isRead && "border-l-4 border-l-rosegold bg-blush/25"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-cream-deep px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                      {NOTIFICATION_TYPE_LABELS[notification.type]}
                    </span>
                    {!notification.isRead ? <span className="text-[0.65rem] text-rosegold-dark">New</span> : null}
                  </div>

                  <h2 className="mt-2 font-display text-lg leading-snug">
                    {notification.link ? (
                      <Link href={notification.link} className="hover:text-rosegold-dark">
                        {notification.title}
                      </Link>
                    ) : (
                      notification.title
                    )}
                  </h2>
                  <p className="mt-1 text-sm text-muted">{notification.message}</p>
                  <p className="mt-2 text-xs text-muted">{formatRelativeTime(notification.createdAt)}</p>
                </div>

                <NotificationItemActions notificationId={notification.id} isRead={notification.isRead} />
              </li>
            ))}
          </ul>

          <Pagination
            page={notifications.page}
            totalPages={notifications.totalPages}
            basePath="/notifications"
          />
        </>
      ) : (
        <EmptyState
          icon={<BellOff size={26} />}
          title="No notifications yet"
          description="Booking updates, studio confirmations and account news will appear here."
          action={{ href: "/booking", label: "Book an appointment" }}
        />
      )}
    </div>
  );
}
