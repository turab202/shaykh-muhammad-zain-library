"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <AlertCircle className="w-12 h-12 text-red-400 mb-4" aria-hidden="true" />
      <h1 className="font-serif font-bold text-2xl text-stone-800 dark:text-stone-200 mb-2">Something went wrong</h1>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-6 max-w-sm">{error.message || "An unexpected error occurred."}</p>
      <button onClick={reset} className="px-4 py-2 bg-emerald-900 text-amber-100 rounded-lg text-sm font-medium hover:bg-emerald-800 transition-colors cursor-pointer">Try again</button>
    </div>
  );
}
