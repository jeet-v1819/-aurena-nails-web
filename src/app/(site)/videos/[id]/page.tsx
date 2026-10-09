import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck, Eye, Tag } from "lucide-react";
import { getRelatedVideos, getVideoById } from "@/server/services/videos";
import { getSiteContent } from "@/server/services/content";
import { VideoCard } from "@/components/site/cards";
import { Badge, SectionHeading } from "@/components/ui/primitives";
import { formatDate, formatSeconds } from "@/lib/format";
import { serializeJsonLd } from "@/lib/seo";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const video = await getVideoById(id);
  if (!video) return { title: "Video not found" };

  return {
    title: video.title,
    description: video.description ?? `${video.title} — a nail art video from the Aurena Nails studio.`,
    alternates: { canonical: `/videos/${video.id}` },
    openGraph: {
      title: video.title,
      description: video.description ?? undefined,
      type: "video.other",
      images: video.thumbnailUrl ? [{ url: video.thumbnailUrl }] : undefined,
      videos: [{ url: video.url }],
    },
  };
}

export default async function VideoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const video = await getVideoById(id);
  if (!video || !video.isActive) notFound();

  const [related, content] = await Promise.all([getRelatedVideos(video.id, video.category.id, 3), getSiteContent()]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: video.description ?? undefined,
    thumbnailUrl: video.thumbnailUrl ? [video.thumbnailUrl] : undefined,
    contentUrl: video.url,
    uploadDate: video.publishedAt.toISOString(),
    ...(video.durationSeconds ? { duration: `PT${Math.round(video.durationSeconds)}S` } : {}),
    publisher: { "@type": "BeautySalon", name: content.siteName },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <section className="section pb-10 pt-10">
        <div className="container-page">
          <Link href="/videos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-charcoal">
            <ArrowLeft size={15} /> All videos
          </Link>

          <div className="mt-6 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <div className="overflow-hidden rounded-[1.75rem] border border-line bg-charcoal">
                <video
                  controls
                  playsInline
                  preload="metadata"
                  poster={video.thumbnailUrl ?? undefined}
                  className="aspect-video w-full"
                >
                  <source src={video.url} />
                  Your browser does not support embedded videos — you can download the clip instead.
                </video>
              </div>

              <h1 className="mt-6 text-3xl md:text-4xl">{video.title}</h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
                <Link href={`/videos?category=${video.category.slug}`} className="text-rosegold-dark">
                  {video.category.name}
                </Link>
                <span className="inline-flex items-center gap-1.5">
                  <Eye size={13} /> {video.viewCount.toLocaleString("en-IN")} views
                </span>
                <span>{formatDate(video.publishedAt)}</span>
                {video.durationSeconds ? <span>{formatSeconds(video.durationSeconds)}</span> : null}
              </div>

              {video.description ? (
                <div className="mt-6 space-y-3 text-sm leading-relaxed text-charcoal-soft">
                  {video.description.split("\n").map((paragraph, index) =>
                    paragraph.trim() ? <p key={index}>{paragraph}</p> : null
                  )}
                </div>
              ) : null}

              {video.tags.length ? (
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted">
                    <Tag size={13} /> Tags
                  </span>
                  {video.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/gallery?tag=${encodeURIComponent(tag)}`}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-charcoal-soft transition hover:border-rosegold-soft"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            <aside className="lg:sticky lg:top-24 lg:h-fit">
              <div className="card p-6">
                {video.isFeatured ? <Badge tone="gold">Studio favourite</Badge> : null}
                <h2 className="mt-3 font-display text-xl">Loved this look?</h2>
                <p className="mt-3 text-sm text-muted">
                  Book the same service and your artist will adapt the design to your nail shape and lifestyle.
                </p>
                <Link href="/booking" className="btn-primary mt-5 w-full">
                  <CalendarCheck size={16} /> Book Appointment
                </Link>
                <Link href="/gallery" className="btn-outline mt-3 w-full">
                  Browse designs
                </Link>
              </div>

              <div className="card mt-6 p-6">
                <h2 className="font-display text-lg">About the studio</h2>
                <p className="mt-3 text-sm text-muted">{content.tagline}</p>
                <p className="mt-3 text-sm text-muted">
                  {content.address} · {content.phone}
                </p>
                <Link href="/about" className="mt-4 inline-block text-sm text-rosegold-dark">
                  Meet Aurena Nails →
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {related.length ? (
        <section className="section bg-cream-deep">
          <div className="container-page">
            <SectionHeading align="left" eyebrow={`More ${video.category.name}`} title="You might also enjoy" />
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <VideoCard key={item.id} video={item} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
