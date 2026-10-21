"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Eye, EyeOff, Mail, UserPlus, ShieldCheck,
  CheckCircle2, AlertCircle, Loader2, KeyRound, X,
} from "lucide-react";
import {
  updateAdminEmail,
  updateAdminPassword,
  createAdmin,
  deleteAdminUser,
  type SettingsFormState,
  type CreateAdminState,
} from "@/server/auth/actions";
import { DeleteButton } from "@/components/admin/DeleteButton";

// ─── Shared primitives ─────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-center gap-4 border-b border-stone-100 px-5 py-4 dark:border-stone-800 sm:px-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
          <Icon className="size-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{title}</h2>
          {description && <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{description}</p>}
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
    </div>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

function Field({
  id, name, label, type = "text", defaultValue, required, autoComplete, hint,
}: {
  id: string; name: string; label: string; type?: string;
  defaultValue?: string; required?: boolean; autoComplete?: string; hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}{required && <span className="text-red-500 ms-0.5">*</span>}
      </label>
      <input
        id={id} name={name} type={type} defaultValue={defaultValue}
        required={required} autoComplete={autoComplete}
        className="min-h-10 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 transition-colors placeholder:text-stone-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
      />
      {hint && <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{hint}</p>}
    </div>
  );
}

function PasswordField({
  id, name, label, autoComplete, required,
}: {
  id: string; name: string; label: string; autoComplete?: string; required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}{required && <span className="text-red-500 ms-0.5">*</span>}
      </label>
      <div className="relative">
        <input
          id={id} name={name} type={show ? "text" : "password"}
          autoComplete={autoComplete} required={required}
          className="min-h-10 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 pe-12 text-sm text-stone-900 transition-colors focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 inset-e-0 flex min-w-10 items-center justify-center text-stone-500 transition-colors hover:text-stone-700 dark:hover:text-stone-200"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function SelectField({
  id, name, label, options, defaultValue,
}: {
  id: string; name: string; label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">{label}</label>
      <select
        id={id} name={name} defaultValue={defaultValue}
        className="min-h-10 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// Combined type for StatusMessage — union of both state shapes
type AnyFormState =
  | { success?: string; error?: string; errors?: Record<string, string[]> }
  | undefined;

function StatusMessage({ state }: { state: AnyFormState }) {
  if (!state) return null;
  const allErrors: string[] = "errors" in state && state.errors
    ? Object.values(state.errors).flat() as string[]
    : state.error
    ? [state.error]
    : [];

  if (state.success) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
        {state.success}
      </div>
    );
  }
  if (allErrors.length > 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
        <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <ul className="space-y-0.5">
          {allErrors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      </div>
    );
  }
  return null;
}

function SubmitButton({ label, pendingLabel, pending }: { label: string; pendingLabel?: string; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-900 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-800 dark:hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
      {pending ? (pendingLabel ?? "Saving…") : label}
    </button>
  );
}

// ─── Email form ─────────────────────────────────────────────────────────────

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(updateAdminEmail, undefined);
  return (
    <SectionCard icon={Mail} title="Email Address" description="Update the email you use to sign in.">
      <form action={action} className="space-y-4">
        <Field id="email" name="email" label="Email address" type="email" defaultValue={currentEmail} required autoComplete="email" />
        <StatusMessage state={state} />
        <SubmitButton label="Update email" pending={pending} />
      </form>
    </SectionCard>
  );
}

// ─── Password form ──────────────────────────────────────────────────────────

export function PasswordForm() {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(updateAdminPassword, undefined);
  return (
    <SectionCard icon={KeyRound} title="Change Password" description="Use a strong password of at least 8 characters.">
      <form action={action} className="space-y-4">
        <FieldGroup>
          <PasswordField id="currentPassword" name="currentPassword" label="Current password" autoComplete="current-password" required />
          <PasswordField id="newPassword" name="newPassword" label="New password" autoComplete="new-password" required />
          <PasswordField id="confirmPassword" name="confirmPassword" label="Confirm new password" autoComplete="new-password" required />
        </FieldGroup>
        <StatusMessage state={state} />
        <SubmitButton label="Update password" pending={pending} />
      </form>
    </SectionCard>
  );
}

// ─── Add admin form ─────────────────────────────────────────────────────────

export function AddAdminForm() {
  const [state, action, pending] = useActionState<CreateAdminState, FormData>(createAdmin, undefined);
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openDialog() {
    setSubmitted(false);
    setOpen(true);
    requestAnimationFrame(() => dialogRef.current?.showModal());
  }

  useEffect(() => {
    if (open && submitted && !pending && state?.success) {
      dialogRef.current?.close();
    }
  }, [open, pending, state, submitted]);

  return (
    <SectionCard
      icon={UserPlus}
      title="Add Admin User"
      description="Create a new admin or editor account. They will be able to sign in immediately."
    >
      {!open ? (
        <button
          type="button"
          onClick={openDialog}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-900 px-3.5 py-2 text-xs font-semibold text-amber-100 shadow-sm transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
        >
          <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
          Add new admin
        </button>
      ) : (
        <dialog
          ref={dialogRef}
          aria-labelledby="add-admin-dialog-title"
          onClose={() => setOpen(false)}
          onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}
          className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-stone-200 bg-white p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900"
        >
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-stone-800">
            <h3 id="add-admin-dialog-title" className="text-sm font-semibold text-stone-900 dark:text-stone-100">Create admin account</h3>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close dialog"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <form action={action} onSubmit={() => setSubmitted(true)} className="space-y-4 px-5 py-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="name" name="name" label="Full name" required autoComplete="name" />
              <Field id="newAdminEmail" name="email" label="Email address" type="email" required autoComplete="off" />
              <PasswordField id="adminPassword" name="password" label="Password" autoComplete="new-password" required />
              <PasswordField id="adminConfirmPassword" name="confirmPassword" label="Confirm password" autoComplete="new-password" required />
            </div>
            <SelectField
              id="role" name="role" label="Role"
              defaultValue="ADMIN"
              options={[
                { value: "ADMIN", label: "Admin — full access" },
                { value: "EDITOR", label: "Editor — can manage content, not users" },
              ]}
            />
            {submitted && <StatusMessage state={state} />}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 pt-4 dark:border-stone-800">
              <button
                type="button"
                disabled={pending}
                onClick={() => { dialogRef.current?.close(); setSubmitted(false); }}
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-stone-300 px-3.5 py-2 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-60 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <SubmitButton label="Create admin" pendingLabel="Creating…" pending={pending} />
            </div>
          </form>
        </dialog>
      )}
    </SectionCard>
  );
}

// ─── Admin user list ────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date;
}

export function AdminUserList({
  users,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  return (
    <SectionCard
      icon={ShieldCheck}
      title="Admin Users"
      description={`${users.length} account${users.length !== 1 ? "s" : ""} with admin access.`}
    >
      {users.length === 0 ? (
        <p className="text-sm text-stone-400">No admin users found.</p>
      ) : (
        <ul className="-mx-4 divide-y divide-stone-100 dark:divide-stone-800 sm:-mx-5">
          {users.map((u) => (
            <AdminUserRow key={u.id} user={u} isSelf={u.id === currentUserId} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function AdminUserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const initials = (user.name ?? user.email)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleColor = user.role === "ADMIN"
    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
    : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400";

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/30 sm:flex-nowrap sm:gap-4 sm:px-6">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-emerald-900 dark:bg-emerald-800 text-amber-100 flex items-center justify-center text-xs font-bold shrink-0">
        {initials}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
            {user.name ?? "(no name)"}
          </span>
          {isSelf && (
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
              You
            </span>
          )}
        </div>
        <p className="text-xs text-stone-400 dark:text-stone-500 truncate">{user.email}</p>
      </div>
      {/* Role badge */}
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${roleColor}`}>
        {user.role}
      </span>
      {/* Joined date */}
      <span className="text-[11px] text-stone-400 dark:text-stone-500 shrink-0 hidden sm:inline">
        {new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
      </span>
      {/* Delete */}
      {!isSelf && (
        <DeleteButton
          action={async () => { await deleteAdminUser(user.id); }}
          label="Remove"
          itemName={`${user.name ?? user.email} (${user.email})`}
          itemType="admin user"
        />
      )}
    </li>
  );
}
