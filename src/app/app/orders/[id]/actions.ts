"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/modules/auth/guards";
import { OrderService } from "@/modules/orders/order.service";
import { PortalService } from "@/modules/portal/portal.service";
import { AssignmentService } from "@/modules/production/assignment.service";

export type OrderStatusActionState = {
  error: string | null;
  success: string | null;
};

export type AssignmentActionState = {
  error: string | null;
  success: string | null;
};

export type PortalAccessActionState = {
  error: string | null;
  success: string | null;
};

export const initialOrderStatusActionState: OrderStatusActionState = {
  error: null,
  success: null,
};

export const initialAssignmentActionState: AssignmentActionState = {
  error: null,
  success: null,
};

export const initialPortalAccessActionState: PortalAccessActionState = {
  error: null,
  success: null,
};

const orderService = new OrderService();
const assignmentService = new AssignmentService();
const portalService = new PortalService();

function revalidateOrderViews(orderId: string) {
  revalidatePath("/app");
  revalidatePath("/app/notifications");
  revalidatePath("/app/orders");
  revalidatePath(`/app/orders/${orderId}`);
}

export async function updateOrderStatusAction(
  _previousState: OrderStatusActionState,
  formData: FormData
): Promise<OrderStatusActionState> {
  try {
    const session = await requirePermission("orders:update");
    const orderId = String(formData.get("orderId") ?? "");

    await orderService.updateStatus(session.factoryId, session.userId, {
      orderId,
      status: String(formData.get("status") ?? "") as never,
      note: String(formData.get("note") ?? ""),
    });

    revalidateOrderViews(orderId);

    return {
      error: null,
      success: "Order status updated.",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update order status.",
      success: null,
    };
  }
}

export async function createAssignmentAction(
  _previousState: AssignmentActionState,
  formData: FormData
): Promise<AssignmentActionState> {
  try {
    const session = await requirePermission("production:assign");
    const orderId = String(formData.get("orderId") ?? "");

    await assignmentService.create(session.factoryId, session.userId, {
      orderId,
      workerId: String(formData.get("workerId") ?? ""),
      station: String(formData.get("station") ?? ""),
      scheduledFor: String(formData.get("scheduledFor") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });

    revalidateOrderViews(orderId);

    return {
      error: null,
      success: "Assignment created.",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not create assignment.",
      success: null,
    };
  }
}

export async function createPortalAccessAction(
  _previousState: PortalAccessActionState,
  formData: FormData
): Promise<PortalAccessActionState> {
  try {
    const session = await requirePermission("orders:view");
    const orderId = String(formData.get("orderId") ?? "");

    await portalService.createStaffPortalAccess(
      session.factoryId,
      orderId,
      session.userId
    );

    revalidateOrderViews(orderId);

    return {
      error: null,
      success: "Portal link is ready.",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not create portal access.",
      success: null,
    };
  }
}
