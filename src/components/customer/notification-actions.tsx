"use client";

/** Mark-as-read / delete controls for the notification centre. */
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCheck, Trash2 } from "lucide-react";
import {
  deleteNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions/customer";
import { notifyResult } from "@/components/ui/toaster";

export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn-outline btn-sm"
      disabled={pending || disabled}
      onClick={() =>
        startTransition(async () => {
          const result = await markAllNotificationsReadAction();
          notifyResult(result);
          router.refresh();
        })
      }
    >
      <CheckCheck size={15} /> {pending ? "Marking…" : "Mark all as read"}
    </button>
  );
}

export function NotificationItemActions({ notificationId, isRead }: { notificationId: string; isRead: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
      {!isRead ? (
        <button
          type="button"
          className="rounded-full p-2 text-muted transition hover:bg-cream-deep hover:text-rosegold-dark"
          aria-label="Mark as read"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await markNotificationReadAction({ notificationId });
              notifyResult(result);
              router.refresh();
            })
          }
        >
          <BellRing size={15} />
        </button>
      ) : null}

      <button
        type="button"
        className="rounded-full p-2 text-muted transition hover:bg-cream-deep hover:text-danger"
        aria-label="Delete notification"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteNotificationAction({ notificationId });
            notifyResult(result);
            router.refresh();
          })
        }
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
