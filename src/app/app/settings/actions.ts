"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/modules/auth/guards";
import { SettingsService } from "@/modules/settings/settings.service";

export type UpdateSettingsActionState = {
  error: string | null;
  message: string | null;
};

export const initialSettingsActionState: UpdateSettingsActionState = {
  error: null,
  message: null,
};

const settingsService = new SettingsService();

export async function updateFactorySettingsAction(
  _previousState: UpdateSettingsActionState,
  formData: FormData
): Promise<UpdateSettingsActionState> {
  try {
    const session = await requirePermission("settings:manage");

    await settingsService.update(session.factoryId, {
      name: String(formData.get("name") ?? ""),
      timezone: String(formData.get("timezone") ?? ""),
      currency: String(formData.get("currency") ?? ""),
      orderCodePrefix: String(formData.get("orderCodePrefix") ?? ""),
      portalDisplayName: String(formData.get("portalDisplayName") ?? ""),
      supportEmail: String(formData.get("supportEmail") ?? ""),
      supportPhone: String(formData.get("supportPhone") ?? ""),
    });

    revalidatePath("/app/settings");
    revalidatePath("/app");
    revalidatePath("/app/orders");
    revalidatePath("/app/reports");
    revalidatePath("/app/crm");
    revalidatePath("/portal");

    return {
      error: null,
      message: "Settings saved.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not save settings.",
      message: null,
    };
  }
}
