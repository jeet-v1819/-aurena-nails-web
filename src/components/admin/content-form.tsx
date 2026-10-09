"use client";

/**
 * Website content editor.
 *
 * The studio's copy lives in the `WebsiteContent` key/value table; this form
 * renders every registered field grouped by section, with titles, textareas and
 * image uploads where appropriate.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { updateContentAction } from "@/server/actions/admin/content";
import { ImageUploader } from "@/components/ui/image-uploader";
import { Alert } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

export type ContentFieldDef = {
  key: string;
  label: string;
  type: string;
  help?: string;
  default: string;
  section: string;
};

export type ContentSectionDef = {
  id: string;
  label: string;
  description?: string;
  fields: ContentFieldDef[];
};

export function ContentForm({
  sections,
  values,
}: {
  sections: ContentSectionDef[];
  values: Record<string, string>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string>>(values);
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? "");
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const section = sections.find((candidate) => candidate.id === activeSection) ?? sections[0];

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);

    const result = await updateContentAction({ values: draft });
    setBusy(false);
    notifyResult(result);

    if (result.ok) {
      setSaved(true);
      setUploadTarget(null);
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      {/* --------------------------------------------------------- sections */}
      <nav aria-label="Content sections" className="lg:sticky lg:top-24 lg:h-fit">
        <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
          {sections.map((item) => (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setActiveSection(item.id)}
                aria-current={activeSection === item.id ? "true" : undefined}
                className={cn(
                  "w-full whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-sm transition",
                  activeSection === item.id
                    ? "bg-blush text-rosegold-dark"
                    : "text-charcoal-soft hover:bg-cream-deep hover:text-charcoal"
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div>
        {error ? (
          <div className="mb-5">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}
        {saved ? (
          <div className="mb-5">
            <Alert tone="success">Website content saved — the changes are already live.</Alert>
          </div>
        ) : null}

        {section ? (
          <section className="card p-6">
            <h2 className="font-display text-xl">{section.label}</h2>
            {section.description ? <p className="mt-1 text-sm text-muted">{section.description}</p> : null}

            <div className="mt-6 space-y-5">
              {section.fields.map((field) => {
                const value = draft[field.key] ?? "";

                return (
                  <div key={field.key} className="min-w-0">
                    <label htmlFor={field.key} className="label">
                      {field.label}
                    </label>

                    {field.type === "textarea" ? (
                      <textarea
                        id={field.key}
                        className="textarea mt-2 min-h-[110px]"
                        value={value}
                        onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                        placeholder={field.default}
                      />
                    ) : field.type === "image" ? (
                      <div className="mt-2 space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            id={field.key}
                            className="input"
                            value={value}
                            onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                            placeholder="/seed/image.jpg or a Cloudinary URL"
                          />
                          <button
                            type="button"
                            className="btn-outline btn-sm shrink-0"
                            onClick={() => setUploadTarget(uploadTarget === field.key ? null : field.key)}
                          >
                            {uploadTarget === field.key ? "Close uploader" : "Upload image"}
                          </button>
                        </div>

                        {uploadTarget === field.key ? (
                          <ImageUploader
                            kind="image"
                            folder="content"
                            label={`Drop a new ${field.label.toLowerCase()} here, or browse`}
                            onUploaded={(files) => {
                              const file = files[0];
                              if (!file) return;
                              setDraft({ ...draft, [field.key]: file.url });
                              setUploadTarget(null);
                            }}
                          />
                        ) : null}

                        {value ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={value}
                            alt=""
                            className="h-28 w-auto rounded-xl border border-line object-cover"
                          />
                        ) : null}
                      </div>
                    ) : (
                      <input
                        id={field.key}
                        type={
                          field.type === "url" || field.type === "tel" || field.type === "email" || field.type === "number"
                            ? field.type
                            : "text"
                        }
                        min={field.type === "number" ? 0 : undefined}
                        step={field.type === "number" ? 1 : undefined}
                        className="input mt-2"
                        value={value}
                        onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                        placeholder={field.default}
                      />
                    )}

                    {field.help ? <p className="mt-1.5 text-xs text-muted">{field.help}</p> : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="sticky bottom-4 mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/95 p-4 backdrop-blur">
          <button type="button" className="btn-primary" onClick={save} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {busy ? "Saving…" : "Save website content"}
          </button>
          <p className="text-xs text-muted">
            Changes appear on the public pages immediately. Empty fields fall back to the built-in default.
          </p>
        </div>
      </div>
    </div>
  );
}
