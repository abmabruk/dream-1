"use server";

import { PortalService } from "@/modules/portal/portal.service";

import type { PortalApprovalActionState } from "./state";

const portalService = new PortalService();

export async function approvePortalOrderAction(
  _previousState: PortalApprovalActionState,
  formData: FormData
): Promise<PortalApprovalActionState> {
  try {
    await portalService.approveOrder(
      String(formData.get("token") ?? ""),
      String(formData.get("note") ?? "")
    );

    return {
      error: null,
      success: "تم تسجيل الموافقة بنجاح.",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "تعذّر الموافقة على هذا الطلب.",
      success: null,
    };
  }
}
