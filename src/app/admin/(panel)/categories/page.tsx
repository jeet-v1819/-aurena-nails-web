import { Tags } from "lucide-react";
import { listAllCategories } from "@/server/services/catalog";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { CategoryManager } from "@/components/admin/category-manager";
import { EmptyState } from "@/components/ui/primitives";

export const metadata = { title: "Categories · Admin" };

export default async function AdminCategoriesPage() {
  const categories = await listAllCategories();

  return (
    <div>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Categories"
        description="One category system for services, gallery collections and videos — each type stays separate in the filters, so keep the names familiar to clients."
      />

      {categories.length ? (
        <CategoryManager
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
            type: category.type,
            description: category.description,
            imageUrl: category.imageUrl,
            imagePublicId: category.imagePublicId,
            isActive: category.isActive,
            sortOrder: category.sortOrder,
            _count: category._count,
          }))}
        />
      ) : (
        <EmptyState
          icon={<Tags size={26} />}
          title="No categories yet"
          description="Create your first category — for example “Gel Nails”, “Bridal” or “Behind the scenes”."
          action={{ href: "/admin/services/new", label: "Add a service instead" }}
        />
      )}
    </div>
  );
}
