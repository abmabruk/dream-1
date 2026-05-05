import "server-only";

import { UserStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { hasPermission, type UserRole } from "@/modules/auth/roles";
import {
  ConvertInquiryInput,
  createInquirySchema,
  updateInquiryStageSchema,
  type ConvertInquiryInputType,
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

  async convertToCustomer(
    factoryId: string,
    actor: { userId: string; role: UserRole },
    inquiryId: string,
    input: ConvertInquiryInputType,
  ) {
    if (!hasPermission(actor.role, "crm:manage")) {
      throw new Error("Not allowed to convert inquiries.");
    }
    const parsed = ConvertInquiryInput.parse(input);
    return this.repository.convertToCustomer(
      factoryId,
      actor.userId,
      inquiryId,
      parsed,
    );
  }
}
