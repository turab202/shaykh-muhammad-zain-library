"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  deleteSession,
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
  redirect("/admin");
}

// ─── Logout action ───────────────────────────────────────

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
