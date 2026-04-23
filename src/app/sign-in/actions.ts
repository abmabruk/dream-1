"use server";

import { redirect } from "next/navigation";

import { AuthService } from "@/modules/auth/auth.service";

export type SignInActionState = {
  error: string | null;
};

const authService = new AuthService();

export async function signInAction(
  _previousState: SignInActionState,
  formData: FormData
): Promise<SignInActionState> {
  const result = await authService.signIn({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!result.ok) {
    return { error: result.message };
  }

  redirect("/app");
}

export async function signOutAction() {
  await authService.signOut();
  redirect("/sign-in");
}
