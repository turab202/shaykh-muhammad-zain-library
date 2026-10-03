"use client";
import { useActionState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { login } from "@/server/auth/actions";
import type { LoginFormState } from "@/server/auth/actions";

function LoginForm() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? `/${locale}/admin`;
  const [state, action, pending] = useActionState<LoginFormState, FormData>(
    login,
    undefined
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-[var(--bg-parchment)]">
      <div className="w-full max-w-sm bg-white dark:bg-stone-900 rounded-xl shadow border border-stone-200 dark:border-stone-800 p-8">
        {/* Library name */}
        <div className="text-center mb-6">
          <h1 className="font-serif font-bold text-lg text-emerald-950 dark:text-emerald-100">
            مكتبة الشيخ محمد زين
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Admin Sign In</p>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="callbackUrl" value={callbackUrl} />

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
            {state?.errors?.email && (
              <p className="mt-1 text-xs text-red-600">{state.errors.email[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
            {state?.errors?.password && (
              <p className="mt-1 text-xs text-red-600">{state.errors.password[0]}</p>
            )}
          </div>

          {state?.message && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-emerald-900 hover:bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-amber-100 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
