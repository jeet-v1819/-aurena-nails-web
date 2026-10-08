import { FileText } from "lucide-react";
import {
  CONTENT_FIELDS,
  CONTENT_FIELDS_BY_SECTION,
  type ContentSection,
} from "@/lib/content/defaults";
import { getContentMap } from "@/server/services/content";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ContentForm } from "@/components/admin/content-form";

export const metadata = { title: "Website content · Admin" };

const SECTION_COPY: Record<ContentSection, { label: string; description: string }> = {
  site: {
    label: "Site & SEO",
    description: "Your studio name, tagline and the description search engines show under the page title.",
  },
  home: {
    label: "Homepage",
    description: "The hero section, section headings and teaser copy on the landing page.",
  },
  about: {
    label: "About page",
    description: "Your story, mission, vision, artist introduction and studio imagery.",
  },
  contact: {
    label: "Contact details",
    description: "Phone, email, address, map and the note shown next to your opening hours.",
  },
  social: {
    label: "Social & WhatsApp",
    description: "Links to your social profiles and the prefilled WhatsApp message clients send you.",
  },
  booking: {
    label: "Booking copy",
    description: "Helper text shown while clients choose their appointment.",
  },
};

export default async function AdminContentPage() {
  const stored = await getContentMap();

  // Merge stored values over the code defaults so every field is editable.
  const values: Record<string, string> = {};
  for (const field of CONTENT_FIELDS) {
    values[field.key] = stored[field.key] ?? field.default;
  }

  const sections = (Object.keys(CONTENT_FIELDS_BY_SECTION) as ContentSection[])
    .map((section) => ({
      id: section,
      label: SECTION_COPY[section]?.label ?? section,
      description: SECTION_COPY[section]?.description,
      fields: CONTENT_FIELDS_BY_SECTION[section].map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        help: field.help,
        default: field.default,
        section,
      })),
    }))
    .filter((section) => section.fields.length > 0);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Studio"
        title="Website content"
        description="Every word and image on the public site is editable here — no code changes needed. Empty fields fall back to the built-in defaults."
      />

      {sections.length ? (
        <ContentForm sections={sections} values={values} />
      ) : (
        <p className="card inline-flex items-center gap-2 p-5 text-sm text-muted">
          <FileText size={16} /> No editable fields are registered.
        </p>
      )}
    </div>
  );
}
