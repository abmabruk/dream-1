import "server-only";

import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type CustomerDetail,
  type UpdateCustomerInput,
} from "./customer.schemas";
import {
  CustomerRepository,
  type CustomerListPagination,
} from "./customer.repository";

export class CustomerService {
  constructor(private readonly repository = new CustomerRepository()) {}

  async list(factoryId: string, pagination: CustomerListPagination = {}) {
    return this.repository.listByFactory(factoryId, pagination);
  }

  async exists(factoryId: string, customerId: string) {
    return this.repository.exists(factoryId, customerId);
  }

  async create(factoryId: string, input: CreateCustomerInput) {
    const parsed = createCustomerSchema.parse(input);
    return this.repository.create(factoryId, parsed);
  }

  async getById(
    factoryId: string,
    customerId: string,
  ): Promise<CustomerDetail> {
    return this.repository.getById(factoryId, customerId);
  }

  async update(
    factoryId: string,
    customerId: string,
    input: UpdateCustomerInput,
  ): Promise<CustomerDetail> {
    const parsed = updateCustomerSchema.parse(input);
    return this.repository.update(factoryId, customerId, parsed);
  }

  async delete(factoryId: string, customerId: string): Promise<{ id: string }> {
    return this.repository.hardDelete(factoryId, customerId);
  }
}
