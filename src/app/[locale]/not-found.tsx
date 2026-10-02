import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import NextLink from "next/link";
import { Compass } from "lucide-react";

export default async function NotFound() {
  // locale is not available in not-found — use a safe default
  let tCommon: Awaited<ReturnType<typeof getTranslations>>;
  try {
    tCommon = await getTranslations("common");
  } catch {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Compass className="w-12 h-12 text-stone-300 mb-4" />
        <h1 className="font-serif font-bold text-2xl text-stone-800 dark:text-stone-200 mb-2">Page not found</h1>
        <NextLink href="/" className="text-sm text-emerald-700 hover:underline">Back to home</NextLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Compass className="w-12 h-12 text-stone-300 mb-4" aria-hidden="true" />
      <h1 className="font-serif font-bold text-2xl text-stone-800 dark:text-stone-200 mb-2">{tCommon("notFound")}</h1>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-6 max-w-sm">{tCommon("error")}</p>
      <Link href="/" className="px-4 py-2 bg-emerald-900 text-amber-100 rounded-lg text-sm font-medium hover:bg-emerald-800 transition-colors">{tCommon("backHome")}</Link>
    </div>
  );
}
