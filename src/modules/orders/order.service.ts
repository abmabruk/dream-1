import "server-only";

import { CustomerService } from "@/modules/customers/customer.service";
import {
  createOrderSchema,
  updateOrderStatusSchema,
  type CreateOrderInput,
  type UpdateOrderStatusInput,
} from "./order.schemas";
import { OrderRepository } from "./order.repository";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
} from "./order-status";

export class OrderService {
  constructor(
    private readonly repository = new OrderRepository(),
    private readonly customerService = new CustomerService()
  ) {}

  async list(factoryId: string) {
    return this.repository.listByFactory(factoryId);
  }

  async getById(factoryId: string, orderId: string) {
    return this.repository.getById(factoryId, orderId);
  }

  async create(factoryId: string, createdById: string, input: CreateOrderInput) {
    const parsed = createOrderSchema.parse(input);
    const customerExists = await this.customerService.exists(
      factoryId,
      parsed.customerId
    );

    if (!customerExists) {
      throw new Error("Selected customer does not belong to this factory.");
    }

    return this.repository.create(factoryId, createdById, parsed);
  }

  async updateStatus(
    factoryId: string,
    actorId: string,
    input: UpdateOrderStatusInput
  ) {
    const parsed = updateOrderStatusSchema.parse(input);
    const existing = await this.repository.findWorkflowState(
      factoryId,
      parsed.orderId
    );

    if (!existing) {
      throw new Error("Order not found in this factory.");
    }

    if (existing.status === parsed.status) {
      return existing;
    }

    const allowedStatuses = ORDER_STATUS_TRANSITIONS[existing.status];

    if (!allowedStatuses.includes(parsed.status)) {
      throw new Error(
        `Cannot move order from ${ORDER_STATUS_LABELS[existing.status]} to ${ORDER_STATUS_LABELS[parsed.status]}.`
      );
    }

    const updated = await this.repository.updateStatus(factoryId, actorId, parsed);

    if (!updated) {
      throw new Error("Order not found in this factory.");
    }

    return updated;
  }
}
