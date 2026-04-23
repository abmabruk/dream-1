import "server-only";

import { db } from "@/lib/db";

import type {
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
}
