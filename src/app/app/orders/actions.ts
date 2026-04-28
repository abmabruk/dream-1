"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/modules/auth/guards";
import { OrderService } from "@/modules/orders/order.service";

import type { CreateOrderActionState } from "./state";

const orderService = new OrderService();

export async function createOrderAction(
  _previousState: CreateOrderActionState,
  formData: FormData
): Promise<CreateOrderActionState> {
  try {
    const session = await requirePermission("orders:create");
    const quotedAmountRaw = String(formData.get("quotedAmount") ?? "").trim();

    await orderService.create(session.factoryId, session.userId, {
      customerId: String(formData.get("customerId") ?? ""),
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      targetDate: String(formData.get("targetDate") ?? ""),
      quotedAmount: quotedAmountRaw ? Number(quotedAmountRaw) : undefined,
    });

    revalidatePath("/app/orders");
    revalidatePath("/app/notifications");
    revalidatePath("/app");

    return { error: null };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "تعذّر إنشاء الطلب.",
    };
  }
}
