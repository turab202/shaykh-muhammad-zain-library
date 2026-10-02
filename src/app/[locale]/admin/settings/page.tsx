import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { EmailForm, PasswordForm } from "./SettingsForm";

export default async function SettingsPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });

  if (!user) redirect("/login");

  return (
    <div className="max-w-lg space-y-8">
      <h1 className="text-xl font-semibold text-zinc-900">Account Settings</h1>

      <section className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-zinc-800">Change Email</h2>
        <EmailForm currentEmail={user.email} />
      </section>

      <section className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-zinc-800">Change Password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
