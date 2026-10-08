import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { WhatsAppButton } from "@/components/site/whatsapp-button";
import { getCurrentUser } from "@/lib/auth/session";
import { getSiteContent } from "@/server/services/content";
import { getBusinessHours } from "@/server/services/business-hours";
import { listFeaturedServices } from "@/server/services/catalog";
import { unreadNotificationCount } from "@/server/services/notifications";
import { prisma } from "@/lib/db/prisma";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [content, hours, user] = await Promise.all([getSiteContent(), getBusinessHours(), getCurrentUser()]);

  const [unread, footerServices] = await Promise.all([
    user ? unreadNotificationCount(user.id) : Promise.resolve(0),
    prisma.service
      .findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
        select: { name: true, slug: true },
        take: 6,
      })
      .catch(() => listFeaturedServices(6).then((items) => items.map((item) => ({ name: item.name, slug: item.slug })))),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-rosegold focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <SiteHeader
        user={
          user
            ? {
                fullName: user.fullName,
                firstName: user.firstName,
                role: user.role,
                avatarUrl: user.avatarUrl,
                unreadNotifications: unread,
              }
            : null
        }
        siteName={content.siteName}
        tagline={content.tagline}
      />

      <main id="main" className="flex-1">
        {children}
      </main>

      <SiteFooter content={content} hours={hours} services={footerServices} />
      <WhatsAppButton number={content.whatsapp} message={content.whatsappMessage} />
    </div>
  );
}
