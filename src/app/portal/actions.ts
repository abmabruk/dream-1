"use server";

import { redirect } from "next/navigation";

import { AuthService } from "@/modules/auth/auth.service";

const authService = new AuthService();

/**
 * Sign out for customer portal users. Identical to the staff signOutAction
 * but redirects to the customer portal login page instead of the staff
 * sign-in page.
 */
export async function customerSignOutAction() {
  await authService.signOut();
  redirect("/portal/login");
}
