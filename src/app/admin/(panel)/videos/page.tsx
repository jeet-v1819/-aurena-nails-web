import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { listCategories } from "@/server/services/catalog";
import { listVideos } from "@/server/services/videos";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { VideoManager } from "@/components/admin/video-manager";
import { EmptyState, Pagination } from "@/components/ui/primitives";
import { parsePage } from "@/lib/utils";

export const metadata = { title: "Videos · Admin" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function AdminVideosPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const [videos, categories] = await Promise.all([
    listVideos({
      search: single(params.q),
      categorySlug: single(params.category),
      includeInactive: true,
      sort: "newest",
      page: parsePage(single(params.page)),
      pageSize: 10,
    }),
    listCategories("VIDEO"),
  ]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Videos"
        description="Short films from the studio — process reels, transformations and after-care advice. Everything streams from Cloudinary; the database keeps only the link and metadata."
      />

      <form method="get" className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="min-w-0 lg:col-span-2">
          <span className="sr-only">Search videos</span>
          <input name="q" defaultValue={single(params.q) ?? ""} placeholder="Search videos…" className="input" />
        </label>
        <label className="min-w-0">
          <span className="sr-only">Filter by collection</span>
          <select name="category" defaultValue={single(params.category) ?? ""} className="select">
            <option value="">All collections</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name} ({category._count.videos})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary">
          Apply
        </button>
      </form>

      {categories.length ? (
        <>
          <VideoManager
            categories={categories.map((category) => ({ id: category.id, name: category.name }))}
            videos={videos.items.map((video) => ({
              id: video.id,
              title: video.title,
              description: video.description,
              url: video.url,
              publicId: video.publicId,
              thumbnailUrl: video.thumbnailUrl,
              durationSeconds: video.durationSeconds,
              width: video.width,
              height: video.height,
              fileSize: video.fileSize,
              format: video.format,
              tags: video.tags,
              isFeatured: video.isFeatured,
              isActive: video.isActive,
              viewCount: video.viewCount,
              publishedAt: video.publishedAt,
              category: { id: video.category.id, name: video.category.name },
            }))}
          />

          {videos.totalPages > 1 ? (
            <Pagination
              page={videos.page}
              totalPages={videos.totalPages}
              basePath="/admin/videos"
              searchParams={{ q: single(params.q), category: single(params.category) }}
            />
          ) : null}

          <p className="mt-6 text-xs text-muted">
            Showing {videos.items.length} of {videos.total} videos.{" "}
            <Link href="/videos" className="text-rosegold-dark" target="_blank">
              View the public videos page
            </Link>
            .
          </p>
        </>
      ) : (
        <EmptyState
          icon={<Clapperboard size={26} />}
          title="Create a video collection first"
          description="Videos belong to a collection such as “Process” or “After-care”. Add one, then upload your clips."
          action={{ href: "/admin/categories", label: "Manage categories" }}
        />
      )}
    </div>
  );
}
