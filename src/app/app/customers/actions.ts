"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/modules/auth/guards";
import { CustomerService } from "@/modules/customers/customer.service";

export type CreateCustomerActionState = {
  error: string | null;
};

const initialCustomerActionState: CreateCustomerActionState = {
  error: null,
};

const customerService = new CustomerService();

export { initialCustomerActionState };

export async function createCustomerAction(
  _previousState: CreateCustomerActionState,
  formData: FormData
): Promise<CreateCustomerActionState> {
  try {
    const session = await requirePermission("orders:create");

    await customerService.create(session.factoryId, {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      city: String(formData.get("city") ?? ""),
      district: String(formData.get("district") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });

    revalidatePath("/app/customers");
    revalidatePath("/app/orders");

    return { error: null };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not create customer.",
    };
  }
}
