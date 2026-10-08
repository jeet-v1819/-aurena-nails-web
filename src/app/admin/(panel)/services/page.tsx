import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, Plus, Sparkles } from "lucide-react";
import { countServices, listCategories, listServices } from "@/server/services/catalog";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { Badge, EmptyState, Pagination } from "@/components/ui/primitives";
import { formatDuration, formatStartingPrice } from "@/lib/format";
import { parsePage } from "@/lib/utils";

export const metadata = { title: "Services · Admin" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function AdminServicesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const [services, categories, counts] = await Promise.all([
    listServices({
      search: single(params.q),
      categorySlug: single(params.category),
      includeInactive: true,
      sort: "newest",
      page: parsePage(single(params.page)),
      pageSize: 12,
    }),
    listCategories("SERVICE"),
    countServices(),
  ]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Services"
        description="Everything clients can book, with the prices you show as guidance only. Inactive services stay in the database but disappear from the website."
        actions={
          <Link href="/admin/services/new" className="btn-primary btn-sm">
            <Plus size={15} /> New service
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="font-display text-2xl">{counts.total}</p>
          <p className="mt-1 text-sm text-muted">Total services</p>
        </div>
        <div className="card p-4">
          <p className="font-display text-2xl">{counts.active}</p>
          <p className="mt-1 text-sm text-muted">Visible on the website</p>
        </div>
        <div className="card p-4">
          <p className="font-display text-2xl">{counts.featured}</p>
          <p className="mt-1 text-sm text-muted">Featured</p>
        </div>
      </div>

      <form method="get" className="card mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="min-w-0 lg:col-span-2">
          <span className="sr-only">Search services</span>
          <input name="q" defaultValue={single(params.q) ?? ""} placeholder="Search services…" className="input" />
        </label>
        <label className="min-w-0">
          <span className="sr-only">Filter by category</span>
          <select name="category" defaultValue={single(params.category) ?? ""} className="select">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary">
          Apply
        </button>
      </form>

      <div className="mt-6">
        {services.items.length ? (
          <>
            <ul className="grid gap-4 lg:grid-cols-2">
              {services.items.map((service) => (
                <li key={service.id} className="card flex gap-4 p-4">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-nude">
                    {service.primaryImage ? (
                      <Image src={service.primaryImage} alt="" fill sizes="96px" className="object-cover" />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center text-nude-dark">
                        <Sparkles size={20} />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg leading-snug">
                        <Link href={`/admin/services/${service.id}`} className="hover:text-rosegold-dark">
                          {service.name}
                        </Link>
                      </h2>
                      {service.isActive ? (
                        <Badge tone="success">
                          <Eye size={11} /> Active
                        </Badge>
                      ) : (
                        <Badge tone="danger">
                          <EyeOff size={11} /> Hidden
                        </Badge>
                      )}
                      {service.isFeatured ? <Badge tone="gold">Featured</Badge> : null}
                      {!service.isAvailable ? <Badge tone="warning">Not bookable</Badge> : null}
                    </div>

                    <p className="mt-1 line-clamp-1 text-xs text-muted">{service.category.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {formatDuration(service.durationMinutes)}
                      {formatStartingPrice(service.startingPrice, service.currency)
                        ? ` · ${formatStartingPrice(service.startingPrice, service.currency)}`
                        : ""}
                      {service.ratingCount ? ` · ${service.ratingAverage.toFixed(1)}★ (${service.ratingCount})` : ""}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/admin/services/${service.id}`} className="btn-outline btn-sm">
                        Edit
                      </Link>
                      <Link href={`/services/${service.slug}`} className="btn-ghost btn-sm text-muted" target="_blank">
                        View on site
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              page={services.page}
              totalPages={services.totalPages}
              basePath="/admin/services"
              searchParams={{ q: single(params.q), category: single(params.category) }}
            />
          </>
        ) : (
          <EmptyState
            icon={<Sparkles size={26} />}
            title="No services found"
            description="Create your first service — name, duration and a short description is enough to get started."
            action={{ href: "/admin/services/new", label: "Add a service" }}
          />
        )}
      </div>
    </div>
  );
}
