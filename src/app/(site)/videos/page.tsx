import type { Metadata } from "next";
import Link from "next/link";
import { Clapperboard, Sparkles } from "lucide-react";
import { listCategories } from "@/server/services/catalog";
import { listVideos } from "@/server/services/videos";
import { getSiteContent } from "@/server/services/content";
import { VideoCard } from "@/components/site/cards";
import { CollectionFilters } from "@/components/site/collection-filters";
import { EmptyState, Pagination } from "@/components/ui/primitives";
import { parsePage } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    title: "Studio Videos",
    description: `Watch nail art being created at ${content.siteName} — process reels, after-care tips and full transformations from the studio chair.`,
    alternates: { canonical: "/videos" },
  };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function VideosPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = {
    search: single(params.q),
    categorySlug: single(params.category),
    sort: (single(params.sort) as "newest" | "oldest" | "popular" | "featured" | undefined) ?? "newest",
    page: parsePage(single(params.page)),
    pageSize: 9,
  };

  const [videos, categories] = await Promise.all([
    listVideos(filters),
    listCategories("VIDEO", { activeOnly: true }),
  ]);

  return (
    <>
      <section className="surface-gradient border-b border-line">
        <div className="container-page py-14">
          <nav aria-label="Breadcrumb" className="text-xs text-muted">
            <Link href="/" className="hover:text-charcoal">
              Home
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-charcoal-soft">Videos</span>
          </nav>

          <div className="mt-5 max-w-3xl">
            <p className="eyebrow">Studio films</p>
            <h1 className="mt-3 text-4xl md:text-5xl">Watch the art come together</h1>
            <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
              Short films from the studio: full transformations, close-ups of our favourite techniques, and quick
              after-care advice so your set lasts.
            </p>
          </div>

          <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-muted">
            <Clapperboard size={14} className="text-rosegold" />
            {videos.total} video{videos.total === 1 ? "" : "s"}
          </p>
        </div>
      </section>

      <section className="section pt-10">
        <div className="container-page">
          <CollectionFilters
            basePath="/videos"
            searchPlaceholder="Search videos…"
            current={{
              q: filters.search,
              category: filters.categorySlug,
              sort: typeof params.sort === "string" ? params.sort : undefined,
            }}
            filters={[
              {
                key: "category",
                label: "Collections",
                options: categories.map((category) => ({
                  value: category.slug,
                  label: category.name,
                  count: category._count.videos,
                })),
              },
            ]}
            sortOptions={[
              { value: "newest", label: "Newest first" },
              { value: "featured", label: "Featured first" },
              { value: "popular", label: "Most watched" },
              { value: "oldest", label: "Oldest first" },
            ]}
          />

          <div className="mt-10">
            {videos.items.length ? (
              <>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {videos.items.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>

                <Pagination
                  page={videos.page}
                  totalPages={videos.totalPages}
                  basePath="/videos"
                  searchParams={{
                    q: filters.search,
                    category: filters.categorySlug,
                    sort: typeof params.sort === "string" ? params.sort : undefined,
                  }}
                />
              </>
            ) : (
              <EmptyState
                icon={<Sparkles size={26} />}
                title="No videos here yet"
                description="New studio films are published regularly — meanwhile, browse the design gallery."
                action={{ href: "/gallery", label: "Open the gallery" }}
              />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
