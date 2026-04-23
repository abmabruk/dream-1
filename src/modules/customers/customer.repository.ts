import "server-only";

import { db } from "@/lib/db";

import type { CreateCustomerInput, CustomerListItem } from "./customer.schemas";

export class CustomerRepository {
  async listByFactory(factoryId: string): Promise<CustomerListItem[]> {
    const customers = await db.customer.findMany({
      where: { factoryId },
      include: {
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      district: customer.district,
      notes: customer.notes,
      orderCount: customer._count.orders,
      createdAt: customer.createdAt.toISOString(),
    }));
  }

  async exists(factoryId: string, customerId: string) {
    const count = await db.customer.count({
      where: {
        id: customerId,
        factoryId,
      },
    });

    return count > 0;
  }

  async create(factoryId: string, input: CreateCustomerInput) {
    return db.customer.create({
      data: {
        factoryId,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        city: input.city || null,
        district: input.district || null,
        notes: input.notes || null,
      },
    });
  }
}
