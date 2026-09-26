import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function AdminDashboardPage() {
  // Server-side auth guard — redirects to /login if no valid session.
  try {
    await requireSession();
  } catch {
    redirect("/login");
  }

  const t = await getTranslations("admin");

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">{t("dashboard")}</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Admin dashboard — Phase 2 will build this out.
      </p>
    </main>
  );
}
