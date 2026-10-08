import Link from "next/link";
import { Inbox, Mail, Phone } from "lucide-react";
import { listMessages } from "@/server/services/messages";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { MessageActions } from "@/components/admin/message-actions";
import { Badge, EmptyState, Pagination } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";
import { parsePage } from "@/lib/utils";

export const metadata = { title: "Messages · Admin" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function AdminMessagesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const statusParam = single(params.status);
  const status = statusParam === "read" || statusParam === "unread" ? statusParam : "all";

  const messages = await listMessages({
    search: single(params.q),
    status,
    page: parsePage(single(params.page)),
    pageSize: 12,
  });

  const tabs = [
    { value: "all", label: "All messages", count: messages.total },
    { value: "unread", label: "Unread", count: messages.unread },
    { value: "read", label: "Read", count: Math.max(0, messages.total - messages.unread) },
  ];

  return (
    <div>
      <AdminPageHeader
        eyebrow="People"
        title="Contact messages"
        description="Everything sent through the website contact form, with a one-click reply in your mail client."
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/messages${tab.value === "all" ? "" : `?status=${tab.value}`}`}
            className={
              status === tab.value
                ? "rounded-full border border-rosegold bg-blush px-3.5 py-1.5 text-sm text-rosegold-dark"
                : "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-charcoal-soft transition hover:border-rosegold-soft"
            }
          >
            {tab.label} <span className="text-muted">{tab.count}</span>
          </Link>
        ))}
      </div>

      <form method="get" className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row">
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search messages</span>
          <input name="q" defaultValue={single(params.q) ?? ""} placeholder="Search name, email, subject or text…" className="input" />
        </label>
        <button type="submit" className="btn-primary sm:w-auto">
          Search
        </button>
      </form>

      <div className="mt-6">
        {messages.items.length ? (
          <>
            <ul className="space-y-4">
              {messages.items.map((message) => (
                <li
                  key={message.id}
                  className={
                    message.isRead
                      ? "card p-5"
                      : "card border-l-4 border-l-rosegold bg-blush/20 p-5"
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-lg">{message.subject}</h2>
                        {message.isRead ? <Badge tone="muted">Read</Badge> : <Badge tone="rose">New</Badge>}
                        {message.user ? <Badge tone="success">Registered customer</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {message.name} · {formatDateTime(message.createdAt)}
                      </p>
                    </div>

                    <MessageActions
                      messageId={message.id}
                      isRead={message.isRead}
                      email={message.email}
                      subject={message.subject}
                      name={message.name}
                    />
                  </div>

                  <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-charcoal-soft">
                    {message.message}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
                    <a href={`mailto:${message.email}`} className="inline-flex items-center gap-1.5 hover:text-rosegold-dark">
                      <Mail size={13} /> {message.email}
                    </a>
                    <a href={`tel:${message.mobile}`} className="inline-flex items-center gap-1.5 hover:text-rosegold-dark">
                      <Phone size={13} /> {message.mobile}
                    </a>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              page={messages.page}
              totalPages={messages.totalPages}
              basePath="/admin/messages"
              searchParams={{ q: single(params.q), status: status === "all" ? undefined : status }}
            />
          </>
        ) : (
          <EmptyState
            icon={<Inbox size={26} />}
            title="No messages here"
            description="Messages sent through the contact form land here — nothing to reply to right now."
            action={{ href: "/admin/messages", label: "Show all messages" }}
          />
        )}
      </div>
    </div>
  );
}
