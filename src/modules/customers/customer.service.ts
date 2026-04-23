import "server-only";

import { createCustomerSchema, type CreateCustomerInput } from "./customer.schemas";
import { CustomerRepository } from "./customer.repository";

export class CustomerService {
  constructor(private readonly repository = new CustomerRepository()) {}

  async list(factoryId: string) {
    return this.repository.listByFactory(factoryId);
  }

  async exists(factoryId: string, customerId: string) {
    return this.repository.exists(factoryId, customerId);
  }

  async create(factoryId: string, input: CreateCustomerInput) {
    const parsed = createCustomerSchema.parse(input);
    return this.repository.create(factoryId, parsed);
  }
}
