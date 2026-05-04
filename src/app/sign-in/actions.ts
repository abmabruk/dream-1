"use server";

import { redirect } from "next/navigation";

import {
  checkSignInRateLimit,
  clearSignInAttempts,
  recordFailedSignIn,
} from "@/lib/rate-limit";
import { AuthService } from "@/modules/auth/auth.service";

import type { SignInActionState, Totp2faActionState } from "./state";

const authService = new AuthService();

function safeRedirectFromForm(value: string): string | null {
  if (!value) return null;
  if (
    value.startsWith("/app") ||
    value.startsWith("/worker") ||
    value.startsWith("/portal")
  )
    return value;
  return null;
}

function defaultLandingForRole(role: string): string {
  switch (role) {
    case "WORKER":
      return "/worker";
    case "CUSTOMER":
      return "/portal/dashboard";
    default:
      return "/app";
  }
}

export async function signInAction(
  _previousState: SignInActionState,
  formData: FormData,
): Promise<SignInActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const requestedRedirect = safeRedirectFromForm(
    String(formData.get("redirect") ?? ""),
  );

  const rateKey = email.toLowerCase().trim();

  const rl = checkSignInRateLimit(rateKey);
  if (!rl.ok) {
    return {
      error: "تم تجاوز المحاولات المسموحة، الرجاء المحاولة بعد ٥ دقائق.",
    };
  }

  let target: string | null = null;

  try {
    const result = await authService.signIn({ email, password });

    if (!result.ok) {
      recordFailedSignIn(rateKey);
      return { error: result.message };
    }

    if (result.requires2fa) {
      // Don't clear attempts yet — 2FA still pending. Cookie carries challenge.
      return {
        error: null,
        requires2fa: true,
        redirect: requestedRedirect,
      };
    }

    clearSignInAttempts(rateKey);
    target = requestedRedirect ?? defaultLandingForRole(result.user.role);
  } catch {
    recordFailedSignIn(rateKey);
    return { error: "بيانات الدخول غير صحيحة." };
  }

  if (target) redirect(target);
  return { error: null };
}

export async function totp2faVerifyAction(
  _previousState: Totp2faActionState,
  formData: FormData,
): Promise<Totp2faActionState> {
  const code = String(formData.get("code") ?? "");
  const requestedRedirect = safeRedirectFromForm(
    String(formData.get("redirect") ?? ""),
  );

  let target: string | null = null;

  try {
    const result = await authService.completeSignIn2fa(code);
    if (!result.ok) {
      return { error: result.message };
    }
    target = requestedRedirect ?? defaultLandingForRole(result.user.role);
  } catch {
    return { error: "تعذّر التحقق من الرمز." };
  }

  if (target) redirect(target);
  return { error: null };
}

export async function totp2faCancelAction() {
  await authService.cancelSignIn2fa();
  redirect("/sign-in");
}

export async function signOutAction() {
  await authService.signOut();
  redirect("/sign-in");
}
