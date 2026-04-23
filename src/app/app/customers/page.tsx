import { requirePermission } from "@/modules/auth/guards";
import { CustomerService } from "@/modules/customers/customer.service";

import { CreateCustomerForm } from "./create-customer-form";

const customerService = new CustomerService();

export default async function CustomersPage() {
  const session = await requirePermission("orders:view");
  const customers = await customerService.list(session.factoryId);

  return (
    <main className="space-y-6">
      <section className="panel">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          Customers
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Factory customer records</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
          Customers are now real persisted records scoped to the signed-in factory.
          Orders can only be created against customers that belong to the same workspace.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="panel overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
            <div>
              <h2 className="text-2xl font-semibold">Customer list</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {customers.length} customers in this factory
              </p>
            </div>
          </div>

          {customers.length === 0 ? (
            <div className="py-10 text-sm text-[var(--muted-foreground)]">
              No customers yet. Create the first one from the form beside this list.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[var(--muted-foreground)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-3 pr-4 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="py-4 pr-4">
                        <p className="font-medium">{customer.name}</p>
                        <p className="mt-1 text-[var(--muted-foreground)]">
                          {customer.email ?? "No email"}
                        </p>
                      </td>
                      <td className="px-4 py-4">{customer.phone ?? "No phone"}</td>
                      <td className="px-4 py-4">
                        {[customer.city, customer.district].filter(Boolean).join(", ") || "No location"}
                      </td>
                      <td className="px-4 py-4">{customer.orderCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <CreateCustomerForm />
      </section>
    </main>
  );
}
