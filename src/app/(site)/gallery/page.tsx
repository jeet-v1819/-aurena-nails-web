import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Images, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listCategories } from "@/server/services/catalog";
import { getGalleryTags, listGalleryImages } from "@/server/services/gallery";
import { getSavedState } from "@/server/services/wishlist";
import { getSiteContent } from "@/server/services/content";
import { CollectionFilters } from "@/components/site/collection-filters";
import { GalleryMasonry } from "@/components/site/gallery-masonry";
import { EmptyState, Pagination } from "@/components/ui/primitives";
import { SERVICE_STYLES, OCCASIONS } from "@/lib/constants";
import { parsePage } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    title: "Nail Art Gallery",
    description: `Browse the ${content.siteName} gallery of hand-painted nail designs — bridal sets, minimal French tips, chrome, ombré, 3D art and seasonal inspiration. Save your favourites and book the look.`,
    alternates: { canonical: "/gallery" },
    openGraph: {
      title: `Nail design gallery — ${content.siteName}`,
      description: "Hand-painted nail art, saved to your wishlist and booked in a tap.",
    },
  };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function GalleryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = {
    search: single(params.q),
    categorySlug: single(params.category),
    style: single(params.style),
    occasion: single(params.occasion),
    tag: single(params.tag),
    sort: (single(params.sort) as "newest" | "oldest" | "popular" | "featured" | undefined) ?? "featured",
    page: parsePage(single(params.page)),
    pageSize: 12,
  };

  const [images, categories, tags, user] = await Promise.all([
    listGalleryImages(filters),
    listCategories("GALLERY", { activeOnly: true }),
    getGalleryTags(),
    getCurrentUser(),
  ]);

  const saved = await getSavedState(user?.id ?? null);

  return (
    <>
      <section className="surface-gradient border-b border-line">
        <div className="container-page py-14">
          <nav aria-label="Breadcrumb" className="text-xs text-muted">
            <Link href="/" className="hover:text-charcoal">
              Home
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-charcoal-soft">Gallery</span>
          </nav>

          <div className="mt-5 max-w-3xl">
            <p className="eyebrow">Portfolio</p>
            <h1 className="mt-3 text-4xl md:text-5xl">Designs we have loved creating</h1>
            <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
              Every set below was painted in the studio. Tap any design to see the details, save it to your wishlist, and
              bring it to your appointment.
            </p>
          </div>

          <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-muted">
            <Images size={14} className="text-rosegold" />
            {images.total} design{images.total === 1 ? "" : "s"}
          </p>
        </div>
      </section>

      <section className="section pt-10">
        <div className="container-page">
          <CollectionFilters
            basePath="/gallery"
            searchPlaceholder="Search designs, tags, styles…"
            current={{
              q: filters.search,
              category: filters.categorySlug,
              style: filters.style,
              occasion: filters.occasion,
              tag: filters.tag,
              sort: typeof params.sort === "string" ? params.sort : undefined,
            }}
            filters={[
              {
                key: "category",
                label: "Collections",
                options: categories.map((category) => ({
                  value: category.slug,
                  label: category.name,
                  count: category._count.galleryImages,
                })),
              },
              { key: "style", label: "Style", options: SERVICE_STYLES.map((s) => ({ value: s, label: s })), variant: "select" },
              { key: "occasion", label: "Occasion", options: OCCASIONS.map((o) => ({ value: o, label: o })), variant: "select" },
              { key: "tag", label: "Tags", options: tags.slice(0, 15).map((row) => ({ value: row.tag, label: row.tag, count: row.count })), variant: "select" },
            ]}
            sortOptions={[
              { value: "featured", label: "Featured first" },
              { value: "newest", label: "Newest designs" },
              { value: "oldest", label: "Oldest first" },
              { value: "popular", label: "Most wishlisted" },
            ]}
          />

          <div className="mt-10">
            {images.items.length ? (
              <>
                <GalleryMasonry
                  images={images.items}
                  savedIds={[...saved.galleryIds]}
                  isAuthenticated={Boolean(user)}
                />

                <Pagination
                  page={images.page}
                  totalPages={images.totalPages}
                  basePath="/gallery"
                  searchParams={{
                    q: filters.search,
                    category: filters.categorySlug,
                    style: filters.style,
                    occasion: filters.occasion,
                    tag: filters.tag,
                    sort: typeof params.sort === "string" ? params.sort : undefined,
                  }}
                />
              </>
            ) : (
              <EmptyState
                icon={<Sparkles size={26} />}
                title="No designs matched those filters"
                description="Try a different tag or collection — or browse everything we have posted."
                action={{ href: "/gallery", label: "Show all designs" }}
              />
            )}
          </div>

          <div className="mt-16 flex flex-col items-center gap-4 rounded-[1.75rem] bg-gradient-to-br from-blush to-cream-deep p-8 text-center">
            <h2 className="text-2xl">Found a design you love?</h2>
            <p className="max-w-xl text-sm text-muted">
              Save it to your wishlist, then book an appointment — your artist will recreate or adapt the look for your
              nails.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/booking" className="btn-primary">
                <CalendarCheck size={16} /> Book Appointment
              </Link>
              <Link href="/videos" className="btn-outline">
                Watch our videos
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
