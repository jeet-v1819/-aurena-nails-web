import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listCategories } from "@/server/services/catalog";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ServiceForm } from "@/components/admin/service-form";
import { Alert } from "@/components/ui/primitives";

export const metadata = { title: "New service · Admin" };

export default async function NewServicePage() {
  const categories = await listCategories("SERVICE");

  return (
    <div>
      <Link href="/admin/services" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-charcoal">
        <ArrowLeft size={15} /> Back to services
      </Link>

      <div className="mt-4">
        <AdminPageHeader
          eyebrow="Catalogue"
          title="New service"
          description="Give the service a clear name, a realistic duration and a short description. You can attach photos and videos right after saving."
        />
      </div>

      {categories.length ? (
        <ServiceForm categories={categories.map((category) => ({ id: category.id, name: category.name }))} />
      ) : (
        <Alert tone="warning" title="Create a category first">
          Services belong to a category. <Link href="/admin/categories" className="underline">Add one now</Link> and then
          come back to this form.
        </Alert>
      )}
    </div>
  );
}
