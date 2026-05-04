"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/modules/auth/guards";
import { InquiryService } from "@/modules/crm/inquiry.service";

import type { InquiryActionState } from "./state";

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
      success: "تم إنشاء الاستفسار بنجاح.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذّر إنشاء الاستفسار.",
      success: null,
    };
  }
}

export async function convertInquiryAction(
  _previousState: InquiryActionState,
  formData: FormData
): Promise<InquiryActionState> {
  try {
    const session = await requirePermission("crm:manage");
    const inquiryId = String(formData.get("inquiryId") ?? "");

    if (!inquiryId) {
      return { error: "معرف الاستفسار مفقود.", success: null };
    }

    const result = await inquiryService.convertToCustomer(
      session.factoryId,
      { userId: session.userId, role: session.role },
      inquiryId,
      {
        customerEmail: String(formData.get("customerEmail") ?? ""),
        customerPhone: String(formData.get("customerPhone") ?? ""),
        customerCity: String(formData.get("customerCity") ?? ""),
        customerDistrict: String(formData.get("customerDistrict") ?? ""),
        orderTitle: String(formData.get("orderTitle") ?? ""),
        orderDescription: String(formData.get("orderDescription") ?? ""),
        orderTargetDate: String(formData.get("orderTargetDate") ?? ""),
      },
    );

    revalidateCrmViews();
    revalidatePath("/app/orders");

    return {
      error: null,
      success: `تم التحويل بنجاح. رمز الطلب: ${result.order.code}`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذّر تحويل الاستفسار.",
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
      success: "تم تحديث الاستفسار بنجاح.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "تعذّر تحديث الاستفسار.",
      success: null,
    };
  }
}
