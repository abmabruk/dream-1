"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { formatZodErrorAr } from "@/lib/zod-helpers";
import { requirePermission } from "@/modules/auth/guards";
import { InquiryService } from "@/modules/crm/inquiry.service";

import type { InquiryActionState } from "./state";

const inquiryService = new InquiryService();

const INQUIRY_FIELD_LABELS_AR: Record<string, string> = {
  name: "الاسم",
  phone: "رقم الجوال",
  email: "البريد الإلكتروني",
  source: "المصدر",
  stage: "المرحلة",
  interest: "الاهتمام",
  budgetAmount: "الميزانية",
  nextFollowUpAt: "تاريخ المتابعة القادمة",
  notes: "الملاحظات",
  assignedToId: "المسؤول",
  inquiryId: "معرف الاستفسار",
  customerEmail: "بريد العميل",
  customerPhone: "جوال العميل",
  customerCity: "المدينة",
  customerDistrict: "الحي",
  orderTitle: "عنوان الطلب",
  orderDescription: "وصف الطلب",
  orderTargetDate: "تاريخ التسليم المستهدف",
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    return formatZodErrorAr(error, INQUIRY_FIELD_LABELS_AR, fallback);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function revalidateCrmViews() {
  revalidatePath("/app");
  revalidatePath("/app/notifications");
  revalidatePath("/app/crm");
}

export async function createInquiryAction(
  _previousState: InquiryActionState,
  formData: FormData,
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
      error: toErrorMessage(error, "تعذّر إنشاء الاستفسار."),
      success: null,
    };
  }
}

export async function convertInquiryAction(
  _previousState: InquiryActionState,
  formData: FormData,
): Promise<InquiryActionState> {
  let newOrderId: string | null = null;
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

    newOrderId = result.order.id;
  } catch (error) {
    return {
      error: toErrorMessage(error, "تعذّر تحويل الاستفسار."),
      success: null,
    };
  }

  // redirect() throws NEXT_REDIRECT — must be outside try/catch
  redirect(`/app/orders/${newOrderId}`);
}

export async function updateInquiryStageAction(
  _previousState: InquiryActionState,
  formData: FormData,
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
      error: toErrorMessage(error, "تعذّر تحديث الاستفسار."),
      success: null,
    };
  }
}
