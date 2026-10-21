"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader } from "lucide-react";
import { adminActionItemClass } from "./AdminActionMenu";

interface ToggleVisibilityButtonProps {
  id: string;
  currentStatus: string; // "PUBLISHED" | "DRAFT" | "ARCHIVED"
  itemName: string;
  action: (id: string, newStatus: string) => Promise<void>;
  compact?: boolean;
  menu?: boolean;
}

export function ToggleVisibilityButton({
  id,
  currentStatus,
  itemName,
  action,
  compact = false,
  menu = false,
}: ToggleVisibilityButtonProps) {
  const [status, setStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();

  const isVisible = status === "PUBLISHED";

  function toggle() {
    const newStatus = isVisible ? "DRAFT" : "PUBLISHED";
    startTransition(async () => {
      await action(id, newStatus);
      setStatus(newStatus);
    });
  }

  const className = menu
    ? adminActionItemClass
    : `inline-flex items-center rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 ${compact ? "size-9 justify-center" : "min-h-9 gap-1 px-3 py-1.5"} ${
        isVisible
          ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
      }`;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      title={isVisible ? `Hide "${itemName}"` : `Show "${itemName}"`}
      aria-label={isVisible ? `Hide ${itemName}` : `Show ${itemName}`}
      className={className}
    >
      {(compact || menu) && (isPending ? (
        <Loader className="size-4 animate-spin" aria-hidden="true" />
      ) : isVisible ? (
        <EyeOff className="size-4" aria-hidden="true" />
      ) : (
        <Eye className="size-4" aria-hidden="true" />
      ))}
      {menu ? (isVisible ? "Hide from public" : "Publish to public") : !compact && (isVisible ? "Hide" : "Publish")}
    </button>
  );
}
