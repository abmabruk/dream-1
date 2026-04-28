"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/modules/auth/guards";
import { UserService } from "@/modules/users/user.service";

import type { UserAdminActionState } from "./state";

const userService = new UserService();

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function createUserAction(
  _previousState: UserAdminActionState,
  formData: FormData
): Promise<UserAdminActionState> {
  try {
    const session = await requirePermission("users:manage");

    await userService.create(
      session.factoryId,
      {
        userId: session.userId,
        role: session.role,
      },
      {
        firstName: String(formData.get("firstName") ?? ""),
        lastName: String(formData.get("lastName") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        role: String(formData.get("role") ?? ""),
        password: String(formData.get("password") ?? ""),
      }
    );

    revalidatePath("/app/users");
    revalidatePath("/app");
    revalidatePath("/app/orders");

    return {
      error: null,
      message: "تم إنشاء المستخدم بنجاح",
    };
  } catch (error) {
    return {
      error: toMessage(error, "تعذّر إنشاء المستخدم."),
      message: null,
    };
  }
}

export async function updateUserAction(
  _previousState: UserAdminActionState,
  formData: FormData
): Promise<UserAdminActionState> {
  try {
    const session = await requirePermission("users:manage");

    await userService.updateManagedUser(
      session.factoryId,
      {
        userId: session.userId,
        role: session.role,
      },
      {
        userId: String(formData.get("userId") ?? ""),
        role: String(formData.get("role") ?? ""),
        status: String(formData.get("status") ?? ""),
      }
    );

    revalidatePath("/app/users");
    revalidatePath("/app");
    revalidatePath("/app/orders");

    return {
      error: null,
      message: "تم تحديث المستخدم بنجاح",
    };
  } catch (error) {
    return {
      error: toMessage(error, "تعذّر تحديث المستخدم."),
      message: null,
    };
  }
}

export async function resetUserPasswordAction(
  _previousState: UserAdminActionState,
  formData: FormData
): Promise<UserAdminActionState> {
  try {
    const session = await requirePermission("users:manage");

    await userService.resetPassword(
      session.factoryId,
      {
        userId: session.userId,
        role: session.role,
      },
      {
        userId: String(formData.get("userId") ?? ""),
        password: String(formData.get("password") ?? ""),
      }
    );

    revalidatePath("/app/users");

    return {
      error: null,
      message: "تم إعادة تعيين كلمة المرور بنجاح",
    };
  } catch (error) {
    return {
      error: toMessage(error, "تعذّر إعادة تعيين كلمة المرور."),
      message: null,
    };
  }
}
