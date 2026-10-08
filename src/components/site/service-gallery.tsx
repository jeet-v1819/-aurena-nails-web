"use client";

/**
 * Service detail media viewer: a large frame plus a thumbnail strip, with
 * videos mixed into the same strip when the studio attached them.
 */
import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

type GalleryImage = {
  id: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  isPrimary: boolean;
};

type GalleryVideo = {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
};

export function ServiceGallery({
  images,
  videos,
  serviceName,
}: {
  images: GalleryImage[];
  videos: GalleryVideo[];
  serviceName: string;
}) {
  const items = [
    ...images.map((image) => ({ kind: "image" as const, ...image })),
    ...videos.map((video) => ({ kind: "video" as const, ...video, alt: video.title, isPrimary: false })),
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const active = items[activeIndex];

  if (!items.length) {
    return (
      <div className="flex aspect-4/5 w-full items-center justify-center rounded-[1.75rem] border border-line bg-gradient-to-br from-blush to-cream-deep">
        <p className="px-8 text-center text-sm text-muted">
          Photos for {serviceName} are coming soon — drop by the studio to see the finish in person.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-4/5 w-full overflow-hidden rounded-[1.75rem] bg-nude">
        {active.kind === "image" ? (
          <Image
            src={active.url}
            alt={active.alt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover"
          />
        ) : (
          <video
            key={active.id}
            controls
            autoPlay
            playsInline
            preload="metadata"
            poster={active.thumbnailUrl ?? undefined}
            className="h-full w-full bg-charcoal object-cover"
          >
            <source src={active.url} />
          </video>
        )}
      </div>

      {items.length > 1 ? (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1" role="tablist" aria-label={`${serviceName} media`}>
          {items.map((item, index) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={item.kind === "video" ? `Play video: ${item.alt}` : item.alt}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-nude transition",
                index === activeIndex ? "border-rosegold" : "border-transparent opacity-75 hover:opacity-100"
              )}
            >
              {item.kind === "image" ? (
                <Image src={item.url} alt="" fill sizes="80px" className="object-cover" />
              ) : item.thumbnailUrl ? (
                <Image src={item.thumbnailUrl} alt="" fill sizes="80px" className="object-cover" />
              ) : (
                <span className="absolute inset-0 bg-charcoal/70" />
              )}
              {item.kind === "video" ? (
                <span className="absolute inset-0 grid place-items-center bg-charcoal/35">
                  <Play size={18} className="text-white" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
