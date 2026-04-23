"use server";

import { PortalService } from "@/modules/portal/portal.service";

export type PortalApprovalActionState = {
  error: string | null;
  success: string | null;
};

export const initialPortalApprovalActionState: PortalApprovalActionState = {
  error: null,
  success: null,
};

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
      success: "Approval has been recorded.",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not approve this order.",
      success: null,
    };
  }
}
