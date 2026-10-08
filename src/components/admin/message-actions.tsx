"use client";

/** Read/unread toggle, mailto reply shortcut and delete for contact messages. */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, MailOpen, Reply, Trash2 } from "lucide-react";
import { deleteMessageAction, setMessageReadAction } from "@/server/actions/admin/people";
import { ConfirmDialog } from "@/components/ui/interactive";
import { notifyResult } from "@/components/ui/toaster";

export function MessageActions({
  messageId,
  isRead,
  email,
  subject,
  name,
}: {
  messageId: string;
  isRead: boolean;
  email: string;
  subject: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const toggleRead = () =>
    startTransition(async () => {
      const result = await setMessageReadAction({ messageId, isRead: !isRead });
      notifyResult(result);
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteMessageAction({ messageId });
      notifyResult(result);
      setDeleteOpen(false);
      if (result.ok) router.refresh();
    });

  const mailto = `mailto:${email}?subject=${encodeURIComponent(`Re: ${subject}`)}&body=${encodeURIComponent(
    `Hi ${name},\n\nThank you for writing to Aurena Nails.\n\n`
  )}`;

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        className="rounded-full p-2 text-muted transition hover:bg-cream-deep hover:text-charcoal"
        aria-label={isRead ? "Mark as unread" : "Mark as read"}
        disabled={pending}
        onClick={toggleRead}
      >
        {isRead ? <Mail size={15} /> : <MailOpen size={15} />}
      </button>

      <a
        href={mailto}
        className="rounded-full p-2 text-muted transition hover:bg-cream-deep hover:text-rosegold-dark"
        aria-label={`Reply to ${name}`}
      >
        <Reply size={15} />
      </a>

      <button
        type="button"
        className="rounded-full p-2 text-muted transition hover:bg-cream-deep hover:text-danger"
        aria-label="Delete message"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 size={15} />
      </button>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this message?"
        message={`The message from ${name} (${email}) will be permanently deleted. This cannot be undone.`}
        confirmLabel="Yes, delete"
        cancelLabel="Cancel"
        onConfirm={remove}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
