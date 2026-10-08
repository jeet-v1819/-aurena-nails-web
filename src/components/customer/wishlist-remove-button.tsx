"use client";

/** Removes one wishlist item, after confirming the intent. */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HeartOff } from "lucide-react";
import { removeWishlistItemAction } from "@/server/actions/customer";
import { ConfirmDialog } from "@/components/ui/interactive";
import { notifyResult } from "@/components/ui/toaster";

export function WishlistRemoveButton({ itemId, label }: { itemId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        className="rounded-full p-2 text-muted transition hover:bg-cream-deep hover:text-danger"
        aria-label={`Remove ${label} from wishlist`}
        onClick={() => setOpen(true)}
      >
        <HeartOff size={16} />
      </button>

      <ConfirmDialog
        open={open}
        title="Remove from wishlist?"
        message={`Are you sure you want to remove “${label}” from your saved items?`}
        confirmLabel={pending ? "Removing…" : "Yes, remove it"}
        cancelLabel="Keep it"
        onClose={() => setOpen(false)}
        onConfirm={() =>
          startTransition(async () => {
            const result = await removeWishlistItemAction({ itemId });
            notifyResult(result);
            setOpen(false);
            if (result.ok) router.refresh();
          })
        }
      />
    </>
  );
}
