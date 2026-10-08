import Link from "next/link";
import Image from "next/image";
import { UserRound, Users } from "lucide-react";
import { countCustomers, listCustomers } from "@/server/services/users";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { CustomerRowActions } from "@/components/admin/customer-actions";
import { Badge, EmptyState, Pagination } from "@/components/ui/primitives";
import { formatDate, initials } from "@/lib/format";
import { parsePage } from "@/lib/utils";

export const metadata = { title: "Customers · Admin" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function AdminCustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const statusParam = single(params.status);
  const status = statusParam === "active" || statusParam === "inactive" ? statusParam : "all";

  const filters = {
    search: single(params.q),
    status: status as "all" | "active" | "inactive",
    page: parsePage(single(params.page)),
    pageSize: 15,
  };

  const [customers, counts] = await Promise.all([listCustomers(filters), countCustomers()]);

  const tabs = [
    { value: "all", label: "All customers", count: counts.total },
    { value: "active", label: "Active", count: counts.active },
    { value: "inactive", label: "Inactive", count: counts.inactive },
  ];

  return (
    <div>
      <AdminPageHeader
        eyebrow="People"
        title="Customers"
        description="Search the client list, correct details, deactivate accounts that should not sign in, and delete records that are no longer needed."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/customers${tab.value === "all" ? "" : `?status=${tab.value}`}`}
            className={
              status === tab.value
                ? "card p-4 ring-1 ring-rosegold-soft"
                : "card p-4 transition hover:-translate-y-0.5"
            }
          >
            <p className="font-display text-2xl">{tab.count}</p>
            <p className="mt-1 text-sm text-muted">{tab.label}</p>
          </Link>
        ))}
      </div>

      <form method="get" className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row">
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search customers</span>
          <input
            name="q"
            defaultValue={filters.search ?? ""}
            placeholder="Search by name, email or mobile number…"
            className="input"
          />
        </label>
        <button type="submit" className="btn-primary sm:w-auto">
          Search
        </button>
      </form>

      <div className="mt-6">
        {customers.items.length ? (
          <>
            <div className="table-wrap hidden lg:block">
              <table className="table-base">
                <caption className="sr-only">Customer list</caption>
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Activity</th>
                    <th scope="col">Joined</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.items.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blush text-xs font-medium text-rosegold-dark">
                            {customer.avatarUrl ? (
                              <Image
                                src={customer.avatarUrl}
                                alt=""
                                width={36}
                                height={36}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              initials(customer.firstName, customer.lastName)
                            )}
                          </span>
                          <span>
                            <span className="block font-medium">
                              {customer.firstName} {customer.lastName}
                            </span>
                            <span className="block text-xs text-muted">
                              {customer.email}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="text-sm">{customer.mobile}</td>
                      <td className="text-sm">
                        {customer._count.appointments} appointment{customer._count.appointments === 1 ? "" : "s"}
                        <span className="block text-xs text-muted">
                          {customer._count.reviews} review{customer._count.reviews === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="text-sm">
                        {formatDate(customer.createdAt)}
                        {customer.lastLoginAt ? (
                          <span className="block text-xs text-muted">Last seen {formatDate(customer.lastLoginAt)}</span>
                        ) : null}
                      </td>
                      <td>
                        {customer.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Inactive</Badge>}
                      </td>
                      <td>
                        <CustomerRowActions
                          customer={{
                            id: customer.id,
                            firstName: customer.firstName,
                            lastName: customer.lastName,
                            email: customer.email,
                            mobile: customer.mobile,
                            isActive: customer.isActive,
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-4 lg:hidden">
              {customers.items.map((customer) => (
                <li key={customer.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-lg">
                        {customer.firstName} {customer.lastName}
                      </p>
                      <p className="truncate text-xs text-muted">{customer.email}</p>
                      <p className="text-xs text-muted">{customer.mobile}</p>
                    </div>
                    {customer.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Inactive</Badge>}
                  </div>

                  <p className="mt-3 text-xs text-muted">
                    {customer._count.appointments} appointments · joined {formatDate(customer.createdAt)}
                  </p>

                  <div className="mt-4">
                    <CustomerRowActions
                      customer={{
                        id: customer.id,
                        firstName: customer.firstName,
                        lastName: customer.lastName,
                        email: customer.email,
                        mobile: customer.mobile,
                        isActive: customer.isActive,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              page={customers.page}
              totalPages={customers.totalPages}
              basePath="/admin/customers"
              searchParams={{ q: filters.search, status: status === "all" ? undefined : status }}
            />
          </>
        ) : (
          <EmptyState
            icon={<Users size={26} />}
            title="No customers match that search"
            description="Try a different name, email or mobile number — or clear the filters."
            action={{ href: "/admin/customers", label: "Show all customers" }}
          />
        )}
      </div>

      <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted">
        <UserRound size={13} /> Deleted customers keep their appointment history; their email and mobile are freed for a
        fresh registration.
      </p>
    </div>
  );
}
