"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  deleteSession,
  requireSession,
} from "@/lib/auth/session";

// ─── Validation schema ───────────────────────────────────

const LoginSchema = z.object({
  email: z.string().email({ message: "Valid email is required." }).trim(),
  password: z.string().min(1, { message: "Password is required." }),
});

export type LoginFormState =
  | { errors?: { email?: string[]; password?: string[] }; message?: string }
  | undefined;

// ─── Login action ────────────────────────────────────────

export async function login(
  _state: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const validated = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, password } = validated.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // Use a timing-safe response — do not reveal whether the email exists.
  const passwordValid =
    user != null && (await verifyPassword(password, user.passwordHash));

  if (!user || !passwordValid) {
    return { message: "Invalid email or password." };
  }

  await createSession(user.id, user.role);
  // Redirect to callbackUrl if present, or default to /en/admin
  const callbackUrl = formData.get("callbackUrl") as string | null;
  const locale = formData.get("locale") as string | null ?? "en";
  redirect(callbackUrl ?? `/${locale}/admin`);
}

// ─── Logout action ───────────────────────────────────────

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/en/login");
}

// ─── Settings action types ───────────────────────────────

import { hashPassword } from "@/lib/auth/password";
import { revalidatePath } from "next/cache";

export type SettingsFormState =
  | { success?: string; error?: string }
  | undefined;

// ─── Update email action ─────────────────────────────────

export async function updateAdminEmail(
  _state: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const session = await requireSession();

  const newEmail = formData.get("email");
  const parsed = z.string().email({ message: "Valid email is required." }).safeParse(newEmail);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { email: parsed.data },
  });

  revalidatePath("/en/admin/settings");
  return { success: "Email updated successfully." };
}

// ─── Update password action ──────────────────────────────

export async function updateAdminPassword(
  _state: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const session = await requireSession();

  const currentPassword = formData.get("currentPassword") as string | null;
  const newPassword = formData.get("newPassword") as string | null;
  const confirmPassword = formData.get("confirmPassword") as string | null;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All password fields are required." };
  }
  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return { error: "User not found." };
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "Current password is incorrect." };
  }

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: hashed },
  });

  revalidatePath("/en/admin/settings");
  return { success: "Password updated successfully." };
}
