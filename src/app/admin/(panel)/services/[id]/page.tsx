import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { getServiceById, listCategories } from "@/server/services/catalog";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ServiceForm } from "@/components/admin/service-form";
import { ServiceMediaManager } from "@/components/admin/service-media-manager";
import { ServiceDangerZone } from "@/components/admin/service-danger-zone";

export const metadata = { title: "Edit service · Admin" };

type PageProps = { params: Promise<{ id: string }> };

export default async function EditServicePage({ params }: PageProps) {
  const { id } = await params;
  const [service, categories] = await Promise.all([getServiceById(id), listCategories("SERVICE")]);

  if (!service) notFound();

  return (
    <div>
      <Link href="/admin/services" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-charcoal">
        <ArrowLeft size={15} /> Back to services
      </Link>

      <div className="mt-4">
        <AdminPageHeader
          eyebrow={service.category.name}
          title={service.name}
          description={`Created ${service.createdAt.toLocaleDateString("en-IN")} · /services/${service.slug}`}
          actions={
            <Link href={`/services/${service.slug}`} className="btn-outline btn-sm" target="_blank">
              <ExternalLink size={15} /> View on site
            </Link>
          }
        />
      </div>

      <div className="space-y-6">
        <ServiceForm
          serviceId={service.id}
          categories={categories.map((category) => ({ id: category.id, name: category.name }))}
          initial={{
            name: service.name,
            slug: service.slug,
            shortDescription: service.shortDescription,
            description: service.description,
            categoryId: service.categoryId,
            durationMinutes: service.durationMinutes,
            startingPrice: service.startingPrice !== null ? String(service.startingPrice) : "",
            regularPrice: service.regularPrice !== null ? String(service.regularPrice) : "",
            promoPrice: service.promoPrice !== null ? String(service.promoPrice) : "",
            currency: service.currency,
            nailType: service.nailType ?? "",
            style: service.style ?? "",
            occasion: service.occasion ?? "",
            difficulty: service.difficulty ?? "",
            preparationInstructions: service.preparationInstructions ?? "",
            afterCareInstructions: service.afterCareInstructions ?? "",
            isActive: service.isActive,
            isFeatured: service.isFeatured,
            isAvailable: service.isAvailable,
            sortOrder: service.sortOrder,
          }}
        />

        <ServiceMediaManager
          serviceId={service.id}
          serviceName={service.name}
          images={service.images.map((image) => ({
            id: image.id,
            url: image.url,
            alt: image.alt,
            isPrimary: image.isPrimary,
            fileSize: null,
          }))}
          videos={service.videos.map((video) => ({
            id: video.id,
            title: video.title,
            url: video.url,
            thumbnailUrl: video.thumbnailUrl,
            durationSeconds: video.durationSeconds,
            fileSize: null,
          }))}
        />

        <ServiceDangerZone
          serviceId={service.id}
          serviceName={service.name}
          appointmentCount={service.appointmentCount}
          reviewCount={service.reviewCount}
        />
      </div>

      <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted">
        <Trash2 size={13} /> Deleting a service also removes its photos and videos from media storage.
      </p>
    </div>
  );
}
