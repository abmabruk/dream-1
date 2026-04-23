import "server-only";

import { UserStatus } from "@prisma/client";

import { db } from "@/lib/db";
import {
  createInquirySchema,
  updateInquiryStageSchema,
  type CreateInquiryInput,
  type UpdateInquiryStageInput,
} from "./inquiry.schemas";
import { InquiryRepository } from "./inquiry.repository";

export class InquiryService {
  constructor(private readonly repository = new InquiryRepository()) {}

  async list(factoryId: string) {
    return this.repository.listByFactory(factoryId);
  }

  async create(factoryId: string, input: CreateInquiryInput) {
    const parsed = createInquirySchema.parse(input);

    if (parsed.assignedToId) {
      const user = await db.user.findFirst({
        where: {
          id: parsed.assignedToId,
          factoryId,
          status: UserStatus.ACTIVE,
          role: {
            in: ["OWNER", "FACTORY_MANAGER", "SALES_MANAGER", "SUPERVISOR"],
          },
        },
      });

      if (!user) {
        throw new Error("Assigned user is not available in this factory.");
      }
    }

    return this.repository.create(factoryId, parsed);
  }

  async updateStage(factoryId: string, input: UpdateInquiryStageInput) {
    const parsed = updateInquiryStageSchema.parse(input);
    const result = await this.repository.updateStage(factoryId, parsed);

    if (result.count === 0) {
      throw new Error("Inquiry not found in this factory.");
    }

    return result;
  }
}
