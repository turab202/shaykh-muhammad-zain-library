"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Sparkles } from "lucide-react";

export function AdminActionMenu({
  itemName,
  itemType,
  children,
}: {
  itemName: string;
  itemType: string;
  children: React.ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 0 });

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const gutter = 12;
    const maxMenuHeight = Math.min(512, Math.max(0, window.innerHeight - gutter * 2));
    menu.style.maxHeight = `${maxMenuHeight}px`;
    const menuRect = menu.getBoundingClientRect();
    const left = Math.max(gutter, Math.min(triggerRect.right - menuRect.width, window.innerWidth - menuRect.width - gutter));
    const below = triggerRect.bottom + 8;
    const availableHeight = Math.max(0, window.innerHeight - below - gutter);

    setPosition({ top: below, left, maxHeight: Math.min(maxMenuHeight, availableHeight) });
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  function handleMenuClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("a")) {
      setOpen(false);
      return;
    }

    if (target.closest("button")) {
      requestAnimationFrame(() => {
        const dialog = menuRef.current?.querySelector("dialog[open]");
        dialog?.addEventListener("close", closeMenu, { once: true });
      });
    }
  }

  useEffect(() => {
    if (!open) return;
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, open, positionMenu]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Actions for ${itemName}`}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 ${
          open
            ? "border-emerald-700 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
            : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
        }`}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          aria-label={`${itemType} actions`}
          onClick={handleMenuClick}
          className="fixed z-[100] w-[min(15rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border border-stone-200 bg-white p-2 shadow-xl shadow-stone-900/10 ring-1 ring-black/5 dark:border-stone-700 dark:bg-stone-900 dark:shadow-black/30 dark:ring-white/5"
          style={{ top: position.top, left: position.left, maxHeight: position.maxHeight }}
        >
          <div className="flex items-center gap-2.5 border-b border-stone-100 px-2.5 pb-2.5 dark:border-stone-800">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                {itemType} actions
              </span>
              <span className="block truncate text-xs font-semibold text-stone-800 dark:text-stone-100">
                {itemName}
              </span>
            </span>
          </div>
          <div className="space-y-1 pt-2">{children}</div>
        </div>,
        document.body,
      )}
    </>
  );
}

export const adminActionItemClass =
  "inline-flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700 dark:text-stone-200 dark:hover:bg-stone-800";

export const adminActionDangerClass =
  "inline-flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-600 dark:text-red-300 dark:hover:bg-red-950/40";
