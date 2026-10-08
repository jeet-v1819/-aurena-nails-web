import Link from "next/link";
import { Images } from "lucide-react";
import { listCategories } from "@/server/services/catalog";
import { listGalleryImages } from "@/server/services/gallery";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { EmptyState, Pagination } from "@/components/ui/primitives";
import { parsePage } from "@/lib/utils";

export const metadata = { title: "Gallery · Admin" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function AdminGalleryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const [images, categories] = await Promise.all([
    listGalleryImages({
      search: single(params.q),
      categorySlug: single(params.category),
      includeInactive: true,
      sort: "featured",
      page: parsePage(single(params.page)),
      pageSize: 12,
    }),
    listCategories("GALLERY"),
  ]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Gallery"
        description="Upload designs in bulk, tag them for search, feature your best work and control the order clients see."
      />

      <form method="get" className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="min-w-0 lg:col-span-2">
          <span className="sr-only">Search designs</span>
          <input name="q" defaultValue={single(params.q) ?? ""} placeholder="Search titles, tags…" className="input" />
        </label>
        <label className="min-w-0">
          <span className="sr-only">Filter by collection</span>
          <select name="category" defaultValue={single(params.category) ?? ""} className="select">
            <option value="">All collections</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name} ({category._count.galleryImages})
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
          <GalleryManager
            categories={categories.map((category) => ({ id: category.id, name: category.name }))}
            images={images.items.map((image) => ({
              id: image.id,
              title: image.title,
              description: image.description,
              url: image.url,
              publicId: image.publicId,
              alt: image.alt,
              width: image.width,
              height: image.height,
              fileSize: image.fileSize,
              format: image.format,
              tags: image.tags,
              style: image.style,
              occasion: image.occasion,
              isFeatured: image.isFeatured,
              isActive: image.isActive,
              sortOrder: image.sortOrder,
              category: { id: image.category.id, name: image.category.name },
            }))}
          />

          {images.totalPages > 1 ? (
            <Pagination
              page={images.page}
              totalPages={images.totalPages}
              basePath="/admin/gallery"
              searchParams={{ q: single(params.q), category: single(params.category) }}
            />
          ) : null}

          <p className="mt-6 text-xs text-muted">
            Showing {images.items.length} of {images.total} designs
            {single(params.category) ? " in this collection" : ""}.
          </p>
        </>
      ) : (
        <EmptyState
          icon={<Images size={26} />}
          title="Create a gallery collection first"
          description="Designs live inside collections such as “Bridal”, “Chrome” or “Minimal”. Add one, then upload your photos."
          action={{ href: "/admin/categories", label: "Manage categories" }}
        />
      )}

      <p className="mt-6 text-xs text-muted">
        <Link href="/gallery" className="text-rosegold-dark" target="_blank">
          Open the public gallery
        </Link>{" "}
        to see how the order looks to clients.
      </p>
    </div>
  );
}
