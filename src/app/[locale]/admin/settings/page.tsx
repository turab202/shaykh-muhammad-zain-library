import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Settings, Shield } from "lucide-react";
import { EmailForm, PasswordForm, AddAdminForm, AdminUserList } from "./SettingsForm";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  let session;
  try {
    session = await requireSession();
  } catch {
    redirect(`/${locale}/login`);
  }

  const [currentUser, allAdmins] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true, role: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "EDITOR"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
  ]);

  if (!currentUser) redirect(`/${locale}/login`);

  const isAdmin = currentUser.role === "ADMIN";

  return (
    <div className="max-w-3xl space-y-8">

      {/* Page header */}
      <div className="flex items-center gap-3 pb-6 border-b border-stone-200 dark:border-stone-800">
        <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0">
          <Settings className="w-5 h-5 text-stone-600 dark:text-stone-400" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Settings</h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Manage your account and admin users
          </p>
        </div>
        {/* Current user badge */}
        <div className="ms-auto flex items-center gap-2 px-3 py-1.5 bg-stone-100 dark:bg-stone-800 rounded-full">
          <div className="w-5 h-5 rounded-full bg-emerald-900 text-amber-100 flex items-center justify-center text-[10px] font-bold">
            {(currentUser.name ?? currentUser.email)[0].toUpperCase()}
          </div>
          <span className="text-xs font-medium text-stone-700 dark:text-stone-300 hidden sm:inline max-w-[140px] truncate">
            {currentUser.name ?? currentUser.email}
          </span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
            {currentUser.role}
          </span>
        </div>
      </div>

      {/* ── Account section ─────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-4">
          Your Account
        </h2>
        <div className="space-y-4">
          <EmailForm currentEmail={currentUser.email} />
          <PasswordForm />
        </div>
      </div>

      {/* ── Admin management section (ADMIN only) ──────── */}
      {isAdmin && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-3.5 h-3.5 text-stone-400" aria-hidden="true" />
            <h2 className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
              Admin Management
            </h2>
          </div>
          <div className="space-y-4">
            <AdminUserList users={allAdmins} currentUserId={session.userId} />
            <AddAdminForm />
          </div>
        </div>
      )}
    </div>
  );
}
