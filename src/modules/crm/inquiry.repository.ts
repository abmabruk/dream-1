import "server-only";

import { db } from "@/lib/db";

import type {
  ConvertInquiryInputType,
  CreateInquiryInput,
  InquiryListItem,
  UpdateInquiryStageInput,
} from "./inquiry.schemas";

export class InquiryRepository {
  async listByFactory(factoryId: string): Promise<InquiryListItem[]> {
    const inquiries = await db.inquiry.findMany({
      where: { factoryId },
      include: {
        assignedTo: true,
      },
      orderBy: [{ stage: "asc" }, { createdAt: "desc" }],
      take: 100,
    });

    return inquiries.map((inquiry) => ({
      id: inquiry.id,
      name: inquiry.name,
      phone: inquiry.phone,
      email: inquiry.email,
      source: inquiry.source,
      stage: inquiry.stage,
      interest: inquiry.interest,
      budgetAmount: inquiry.budgetAmount ? Number(inquiry.budgetAmount) : null,
      nextFollowUpAt: inquiry.nextFollowUpAt?.toISOString() ?? null,
      notes: inquiry.notes,
      assignedToName: inquiry.assignedTo
        ? `${inquiry.assignedTo.firstName} ${inquiry.assignedTo.lastName}`.trim()
        : null,
      convertedCustomerId: inquiry.convertedCustomerId,
      convertedOrderId: inquiry.convertedOrderId,
      convertedAt: inquiry.convertedAt?.toISOString() ?? null,
      createdAt: inquiry.createdAt.toISOString(),
    }));
  }

  async create(factoryId: string, input: CreateInquiryInput) {
    return db.inquiry.create({
      data: {
        factoryId,
        assignedToId: input.assignedToId || null,
        name: input.name,
        phone: input.phone,
        email: input.email || null,
        source: input.source,
        interest: input.interest || null,
        budgetAmount: input.budgetAmount ?? null,
        nextFollowUpAt: input.nextFollowUpAt
          ? new Date(input.nextFollowUpAt)
          : undefined,
        notes: input.notes || null,
      },
    });
  }

  async updateStage(factoryId: string, input: UpdateInquiryStageInput) {
    return db.inquiry.updateMany({
      where: {
        id: input.inquiryId,
        factoryId,
      },
      data: {
        stage: input.stage,
        notes: input.notes || null,
        nextFollowUpAt: input.nextFollowUpAt
          ? new Date(input.nextFollowUpAt)
          : null,
      },
    });
  }

  async convertToCustomer(
    factoryId: string,
    actorId: string,
    inquiryId: string,
    input: ConvertInquiryInputType,
  ) {
    return db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1))`,
        `order_code:${factoryId}`,
      );
      const inquiry = await tx.inquiry.findFirst({
        where: { id: inquiryId, factoryId },
      });
      if (!inquiry) {
        throw new Error("Inquiry not found.");
      }
      if (inquiry.stage === "WON" || inquiry.stage === "LOST") {
        throw new Error("Inquiry already closed.");
      }
      if (inquiry.convertedCustomerId) {
        throw new Error("Inquiry already converted.");
      }

      const customer = await tx.customer.create({
        data: {
          factoryId,
          name: inquiry.name,
          email: input.customerEmail || inquiry.email || null,
          phone: input.customerPhone || inquiry.phone || null,
          city: input.customerCity || null,
          district: input.customerDistrict || null,
        },
      });

      const factory = await tx.factory.findUnique({
        where: { id: factoryId },
        select: { orderCodePrefix: true },
      });
      const prefix = factory?.orderCodePrefix ?? "ORD";
      const lastOrder = await tx.order.findFirst({
        where: { factoryId, code: { startsWith: `${prefix}-` } },
        orderBy: { createdAt: "desc" },
        select: { code: true },
      });
      let seq = 1;
      if (lastOrder?.code) {
        const parts = lastOrder.code.split("-");
        const num = parseInt(parts[parts.length - 1] ?? "0", 10);
        if (Number.isFinite(num)) seq = num + 1;
      }
      const code = `${prefix}-${String(seq).padStart(5, "0")}`;

      const order = await tx.order.create({
        data: {
          factoryId,
          customerId: customer.id,
          code,
          title: input.orderTitle,
          description: input.orderDescription || null,
          status: "DRAFT",
          targetDate: input.orderTargetDate
            ? new Date(input.orderTargetDate)
            : null,
          createdById: actorId,
        },
      });

      const updatedInquiry = await tx.inquiry.update({
        where: { id: inquiryId },
        data: {
          stage: "WON",
          convertedCustomerId: customer.id,
          convertedOrderId: order.id,
          convertedAt: new Date(),
          convertedByUserId: actorId,
        },
      });

      return { inquiry: updatedInquiry, customer, order };
    });
  }
}
