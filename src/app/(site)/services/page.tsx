import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Clock, Sparkles } from "lucide-react";
import { getSiteContent } from "@/server/services/content";
import { getCurrentUser } from "@/lib/auth/session";
import { getSavedState } from "@/server/services/wishlist";
import { getServiceFacets, listCategories, listServices } from "@/server/services/catalog";
import { ServiceCard } from "@/components/site/cards";
import { CollectionFilters } from "@/components/site/collection-filters";
import { EmptyState, GridSkeleton, Pagination } from "@/components/ui/primitives";
import { SERVICE_STYLES, OCCASIONS, NAIL_TYPES } from "@/lib/constants";
import { parsePage } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    title: "Nail Services & Price Guide",
    description: `Explore every nail service at ${content.siteName} — gel, acrylic, French, bridal, extensions and custom nail art. See duration, starting prices and book online.`,
    alternates: { canonical: "/services" },
    openGraph: { title: `Nail services at ${content.siteName}`, description: content.seoDescription },
  };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ServicesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = parsePage(single(params.page));
  const filters = {
    search: single(params.q),
    categorySlug: single(params.category),
    style: single(params.style),
    occasion: single(params.occasion),
    nailType: single(params.nail),
    sort: (single(params.sort) as "newest" | "price-asc" | "price-desc" | "rating" | "popular" | undefined) ?? "newest",
    page,
    pageSize: 9,
  };

  const [services, categories, facets, content, user] = await Promise.all([
    listServices(filters),
    listCategories("SERVICE", { activeOnly: true }),
    getServiceFacets(),
    getSiteContent(),
    getCurrentUser(),
  ]);

  const saved = await getSavedState(user?.id ?? null);

  // Facet lists come from the database, falling back to the studio's standard
  // vocabulary so the filters are never empty.
  const styleOptions = (facets.styles.length ? facets.styles : [...SERVICE_STYLES]).map((value) => ({
    value,
    label: value,
  }));
  const occasionOptions = (facets.occasions.length ? facets.occasions : [...OCCASIONS]).map((value) => ({
    value,
    label: value,
  }));
  const nailOptions = (facets.nailTypes.length ? facets.nailTypes : [...NAIL_TYPES]).map((value) => ({
    value,
    label: value,
  }));

  const activeCategory = categories.find((category) => category.slug === filters.categorySlug);

  return (
    <>
      <section className="surface-gradient border-b border-line">
        <div className="container-page py-14">
          <nav aria-label="Breadcrumb" className="text-xs text-muted">
            <Link href="/" className="hover:text-charcoal">
              Home
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-charcoal-soft">Services</span>
          </nav>

          <div className="mt-5 max-w-3xl">
            <p className="eyebrow">Service menu</p>
            <h1 className="mt-3 text-4xl md:text-5xl">
              {activeCategory ? activeCategory.name : "Nail services crafted around you"}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
              {activeCategory?.description ??
                `Every service at ${content.siteName} includes a consultation, precise prep and a finish designed to last. Prices shown are starting points — your artist will confirm the exact quote before you begin.`}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles size={14} className="text-rosegold" />
                {services.total} service{services.total === 1 ? "" : "s"}
              </span>
              {facets.maxDuration ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={14} className="text-rosegold" />
                  Appointments from 30 minutes
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="section pt-10">
        <div className="container-page">
          <CollectionFilters
            basePath="/services"
            searchPlaceholder="Search services…"
            current={{
              q: filters.search,
              category: filters.categorySlug,
              style: filters.style,
              occasion: filters.occasion,
              nail: filters.nailType,
              sort: params.sort ? String(params.sort) : undefined,
            }}
            filters={[
              {
                key: "category",
                label: "Categories",
                options: categories.map((category) => ({
                  value: category.slug,
                  label: category.name,
                  count: category._count.services,
                })),
              },
              { key: "style", label: "Style", options: styleOptions, variant: "select" },
              { key: "occasion", label: "Occasion", options: occasionOptions, variant: "select" },
              { key: "nail", label: "Nail type", options: nailOptions, variant: "select" },
            ]}
            sortOptions={[
              { value: "newest", label: "Recommended" },
              { value: "price-asc", label: "Price: low to high" },
              { value: "price-desc", label: "Price: high to low" },
              { value: "rating", label: "Top rated" },
              { value: "popular", label: "Most viewed" },
              { value: "duration-asc", label: "Shortest first" },
            ]}
          />

          <div className="mt-10">
            {services.items.length ? (
              <>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {services.items.map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      saved={saved.serviceIds.has(service.id)}
                      isAuthenticated={Boolean(user)}
                    />
                  ))}
                </div>

                <Pagination
                  page={services.page}
                  totalPages={services.totalPages}
                  basePath="/services"
                  searchParams={{
                    q: filters.search,
                    category: filters.categorySlug,
                    style: filters.style,
                    occasion: filters.occasion,
                    nail: filters.nailType,
                    sort: typeof params.sort === "string" ? params.sort : undefined,
                  }}
                />
              </>
            ) : (
              <EmptyState
                icon={<Sparkles size={26} />}
                title="No services matched those filters"
                description="Try clearing a filter or browsing the full menu — we add new designs regularly."
                action={{ href: "/services", label: "Show all services" }}
              />
            )}
          </div>

          <div className="mt-16 rounded-[1.75rem] bg-gradient-to-br from-blush to-cream-deep p-8 text-center">
            <h2 className="text-2xl">Not sure which service to choose?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted">
              Send us a photo of the design you love, or book a consultation slot — we will recommend the right service
              for your nails.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/booking" className="btn-primary">
                <CalendarCheck size={16} /> Book Appointment
              </Link>
              <Link href="/contact" className="btn-outline">
                Ask a question
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** Reserved for a future Suspense boundary; exported so the tree stays flexible. */
export function ServicesLoading() {
  return <GridSkeleton count={6} />;
}
