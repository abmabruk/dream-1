"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/modules/auth/guards";
import { InquiryService } from "@/modules/crm/inquiry.service";

export type InquiryActionState = {
  error: string | null;
  success: string | null;
};

export const initialInquiryActionState: InquiryActionState = {
  error: null,
  success: null,
};

const inquiryService = new InquiryService();

function revalidateCrmViews() {
  revalidatePath("/app");
  revalidatePath("/app/notifications");
  revalidatePath("/app/crm");
}

export async function createInquiryAction(
  _previousState: InquiryActionState,
  formData: FormData
): Promise<InquiryActionState> {
  try {
    const session = await requirePermission("crm:manage");
    const budgetAmountRaw = String(formData.get("budgetAmount") ?? "").trim();

    await inquiryService.create(session.factoryId, {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      source: String(formData.get("source") ?? "") as never,
      interest: String(formData.get("interest") ?? ""),
      budgetAmount: budgetAmountRaw ? Number(budgetAmountRaw) : undefined,
      nextFollowUpAt: String(formData.get("nextFollowUpAt") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      assignedToId: String(formData.get("assignedToId") ?? ""),
    });

    revalidateCrmViews();

    return {
      error: null,
      success: "Inquiry created.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create inquiry.",
      success: null,
    };
  }
}

export async function updateInquiryStageAction(
  _previousState: InquiryActionState,
  formData: FormData
): Promise<InquiryActionState> {
  try {
    const session = await requirePermission("crm:manage");

    await inquiryService.updateStage(session.factoryId, {
      inquiryId: String(formData.get("inquiryId") ?? ""),
      stage: String(formData.get("stage") ?? "") as never,
      notes: String(formData.get("notes") ?? ""),
      nextFollowUpAt: String(formData.get("nextFollowUpAt") ?? ""),
    });

    revalidateCrmViews();

    return {
      error: null,
      success: "Inquiry updated.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not update inquiry.",
      success: null,
    };
  }
}
