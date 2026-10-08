"use client";

/** Heart button that saves/removes a service or gallery design from the wishlist. */
import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toggleGalleryWishlistAction, toggleServiceWishlistAction } from "@/server/actions/customer";

export function SaveToWishlist({
  kind,
  id,
  initialSaved,
  isAuthenticated,
  label,
  className,
  withText = false,
}: {
  kind: "service" | "gallery";
  id: string;
  initialSaved: boolean;
  isAuthenticated: boolean;
  label: string;
  className?: string;
  withText?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const toggle = () => {
    if (!isAuthenticated) {
      toast.info("Please sign in to save your favourites.", {
        action: { label: "Sign in", onClick: () => router.push("/login?callbackUrl=/wishlist") },
      });
      return;
    }

    startTransition(async () => {
      const payload = kind === "service" ? { serviceId: id } : { galleryImageId: id };
      const result =
        kind === "service" ? await toggleServiceWishlistAction(payload) : await toggleGalleryWishlistAction(payload);

      if (result.ok) {
        setSaved(result.data?.saved ?? !saved);
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${label} from wishlist` : `Save ${label} to wishlist`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border p-2 text-xs transition",
        saved
          ? "border-rosegold bg-blush text-rosegold-dark"
          : "border-line bg-white/90 text-charcoal-soft hover:border-rosegold hover:text-rosegold",
        pending && "opacity-60",
        withText && "px-3",
        className
      )}
    >
      <Heart size={15} className={cn(saved && "fill-rosegold text-rosegold")} />
      {withText ? <span>{saved ? "Saved" : "Save"}</span> : null}
    </button>
  );
}
