import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Settings, Shield } from "lucide-react";
import { EmailForm, PasswordForm, AddAdminForm, AdminUserList } from "./SettingsForm";
import { AdminPageHeading } from "@/components/admin/AdminPageChrome";

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
    <div className="mx-auto max-w-360 space-y-5">
      <AdminPageHeading title="Settings" description="Manage your account and admin users" icon={Settings}
        action={<div className="flex min-w-0 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">{(currentUser.name ?? currentUser.email)[0].toUpperCase()}</div>
          <span className="hidden max-w-40 truncate text-xs font-medium text-stone-700 dark:text-stone-300 sm:inline">{currentUser.name ?? currentUser.email}</span>
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">{currentUser.role}</span>
        </div>}
      />

      {/* ── Account section ─────────────────────────────── */}
      <div className="space-y-3">
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
          <div className="flex items-center gap-2">
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
