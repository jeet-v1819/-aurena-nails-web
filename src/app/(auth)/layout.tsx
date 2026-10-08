import Link from "next/link";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { getSiteContent } from "@/server/services/content";
import { APP_NAME } from "@/lib/constants";

/**
 * Minimal, distraction-free shell for the sign-in / registration screens:
 * brand panel on the left, form on the right, no site navigation to wander off
 * into mid-task.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const content = await getSiteContent();

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-charcoal lg:block">
        <Image
          src={content.heroImage}
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/60 to-charcoal/20" />

        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link href="/" className="inline-flex items-center gap-2 font-display text-2xl">
            <Sparkles size={20} className="text-rosegold-soft" />
            {APP_NAME}
          </Link>

          <div className="max-w-md">
            <p className="text-xs uppercase tracking-[0.24em] text-rosegold-soft">{content.tagline}</p>
            <h2 className="mt-4 font-display text-4xl leading-tight text-white">{content.heroTitle}</h2>
            <p className="mt-4 text-sm leading-relaxed text-white/75">{content.heroDescription}</p>
          </div>

          <p className="text-xs text-white/60">
            {content.address} · {content.phone}
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col justify-center bg-cream px-5 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="inline-flex items-center gap-2 font-display text-xl lg:hidden">
            <Sparkles size={18} className="text-rosegold" />
            {APP_NAME}
          </Link>
          <div className="mt-6 lg:mt-0">{children}</div>

          <p className="mt-10 text-center text-xs text-muted">
            <Link href="/" className="hover:text-charcoal">
              ← Back to the website
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
