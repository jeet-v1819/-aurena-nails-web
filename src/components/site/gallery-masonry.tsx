"use client";

/**
 * Masonry gallery with an accessible full-screen lightbox.
 * Keyboard: Esc closes, ←/→ move between designs.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { GalleryCard } from "@/components/site/cards";
import type { GalleryImageDTO } from "@/server/services/gallery";

export function GalleryMasonry({
  images,
  savedIds = [],
  isAuthenticated = false,
}: {
  images: GalleryImageDTO[];
  savedIds?: string[];
  isAuthenticated?: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const saved = useMemo(() => new Set(savedIds), [savedIds]);

  const close = useCallback(() => setOpenIndex(null), []);
  const next = useCallback(
    () => setOpenIndex((index) => (index === null ? null : (index + 1) % images.length)),
    [images.length]
  );
  const previous = useCallback(
    () => setOpenIndex((index) => (index === null ? null : (index - 1 + images.length) % images.length)),
    [images.length]
  );

  useEffect(() => {
    if (openIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, close, next, previous]);

  const active = openIndex === null ? null : images[openIndex];

  return (
    <>
      <div className="masonry">
        {images.map((image, index) => (
          <GalleryCard
            key={image.id}
            image={image}
            saved={saved.has(image.id)}
            isAuthenticated={isAuthenticated}
            onOpen={() => setOpenIndex(index)}
          />
        ))}
      </div>

      <AnimatePresence>
        {active ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex flex-col bg-charcoal/95 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={`${active.title} — full screen preview`}
          >
            <div className="flex items-center justify-between gap-4 px-4 py-3 text-white/90 sm:px-6">
              <div className="min-w-0">
                <p className="truncate font-display text-lg">{active.title}</p>
                <p className="text-xs text-white/60">
                  {active.category.name}
                  {active.style ? ` · ${active.style}` : ""}
                  {active.occasion ? ` · ${active.occasion}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/gallery/${active.id}`}
                  className="rounded-full p-2 transition hover:bg-white/10"
                  aria-label="Open design page"
                >
                  <ExternalLink size={18} />
                </Link>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full p-2 transition hover:bg-white/10"
                  aria-label="Close preview"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="relative flex flex-1 items-center justify-center px-3 pb-6 sm:px-6">
              <button
                type="button"
                onClick={previous}
                className="absolute left-2 z-10 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:left-6"
                aria-label="Previous design"
              >
                <ChevronLeft size={22} />
              </button>

              <motion.div
                key={active.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="relative h-full max-h-[76vh] w-full max-w-4xl"
              >
                <Image
                  src={active.url}
                  alt={active.alt ?? active.title}
                  fill
                  sizes="90vw"
                  className="object-contain"
                  priority
                />
              </motion.div>

              <button
                type="button"
                onClick={next}
                className="absolute right-2 z-10 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:right-6"
                aria-label="Next design"
              >
                <ChevronRight size={22} />
              </button>
            </div>

            {active.description ? (
              <p className="mx-auto max-w-3xl px-6 pb-6 text-center text-sm text-white/70">{active.description}</p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
