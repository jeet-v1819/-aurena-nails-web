import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck, Heart, Palette, Sparkles, Tag } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getGalleryImageById, getRelatedGalleryImages } from "@/server/services/gallery";
import { getSavedState } from "@/server/services/wishlist";
import { getSiteContent } from "@/server/services/content";
import { GalleryCard } from "@/components/site/cards";
import { SaveToWishlist } from "@/components/site/save-to-wishlist";
import { Badge, Divider, SectionHeading } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const image = await getGalleryImageById(id);
  if (!image) return { title: "Design not found" };

  return {
    title: `${image.title} — Nail Art Design`,
    description:
      image.description ??
      `${image.title}: a ${image.category.name} nail design from the Aurena Nails studio. Save it to your wishlist and book the look.`,
    alternates: { canonical: `/gallery/${image.id}` },
    openGraph: {
      title: image.title,
      description: image.description ?? `A ${image.category.name} design by Aurena Nails.`,
      images: [{ url: image.url, width: image.width ?? undefined, height: image.height ?? undefined }],
    },
  };
}

export default async function GalleryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const image = await getGalleryImageById(id);
  if (!image || !image.isActive) notFound();

  const [user, related, content] = await Promise.all([
    getCurrentUser(),
    getRelatedGalleryImages(image.id, image.category.id, 4),
    getSiteContent(),
  ]);
  const saved = await getSavedState(user?.id ?? null);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name: image.title,
    description: image.description ?? undefined,
    contentUrl: image.url,
    width: image.width ?? undefined,
    height: image.height ?? undefined,
    datePublished: image.createdAt.toISOString(),
    creator: { "@type": "BeautySalon", name: content.siteName },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="section pb-8 pt-10">
        <div className="container-page">
          <Link href="/gallery" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-charcoal">
            <ArrowLeft size={15} /> Back to gallery
          </Link>

          <div className="mt-6 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
            <figure className="overflow-hidden rounded-[1.75rem] border border-line bg-nude">
              <div className="relative w-full" style={{ aspectRatio: image.width && image.height ? `${image.width} / ${image.height}` : "4 / 5" }}>
                <Image
                  src={image.url}
                  alt={image.alt ?? image.title}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover"
                />
              </div>
            </figure>

            <div>
              <nav aria-label="Breadcrumb" className="text-xs text-muted">
                <Link href="/gallery" className="hover:text-charcoal">
                  Gallery
                </Link>
                <span aria-hidden="true"> / </span>
                <Link href={`/gallery?category=${image.category.slug}`} className="hover:text-charcoal">
                  {image.category.name}
                </Link>
              </nav>

              <h1 className="mt-4 text-3xl md:text-4xl">{image.title}</h1>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone="rose">{image.category.name}</Badge>
                {image.style ? <Badge tone="muted">{image.style}</Badge> : null}
                {image.occasion ? <Badge tone="gold">{image.occasion}</Badge> : null}
                {image.isFeatured ? <Badge tone="success">Studio favourite</Badge> : null}
              </div>

              {image.description ? (
                <p className="mt-5 text-sm leading-relaxed text-charcoal-soft">{image.description}</p>
              ) : null}

              <dl className="mt-6 space-y-3 text-sm">
                {image.designDate ? (
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <dt className="flex items-center gap-1.5 text-muted">
                      <Palette size={14} /> Created
                    </dt>
                    <dd>{formatDate(image.designDate)}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <dt className="flex items-center gap-1.5 text-muted">
                    <Sparkles size={14} /> Added to portfolio
                  </dt>
                  <dd>{formatDate(image.createdAt)}</dd>
                </div>
              </dl>

              {image.tags.length ? (
                <div className="mt-6">
                  <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted">
                    <Tag size={13} /> Tags
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {image.tags.map((tag) => (
                      <Link
                        key={tag}
                        href={`/gallery?tag=${encodeURIComponent(tag)}`}
                        className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-charcoal-soft transition hover:border-rosegold-soft"
                      >
                        #{tag}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <Divider className="my-7" />

              <div className="flex flex-wrap items-center gap-3">
                <Link href="/booking" className="btn-primary">
                  <CalendarCheck size={16} /> Book this look
                </Link>
                <SaveToWishlist
                  kind="gallery"
                  id={image.id}
                  initialSaved={saved.galleryIds.has(image.id)}
                  isAuthenticated={Boolean(user)}
                  label={image.title}
                  withText
                  className="px-4 py-3"
                />
              </div>

              <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted">
                <Heart size={13} className="text-rosegold" />
                Saved designs are shared with your artist when you arrive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {related.length ? (
        <section className="section bg-cream-deep">
          <div className="container-page">
            <SectionHeading align="left" eyebrow="More from this collection" title={`Other ${image.category.name} designs`} />
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <GalleryCard key={item.id} image={item} saved={saved.galleryIds.has(item.id)} isAuthenticated={Boolean(user)} />
              ))}
            </div>
            <Link href={`/gallery?category=${image.category.slug}`} className="btn-outline mt-8">
              View the whole collection
            </Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
