"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Eye, EyeOff, Mail, Lock, UserPlus, Trash2, ShieldCheck,
  CheckCircle2, AlertCircle, Loader2, User, KeyRound,
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
    <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{title}</h2>
          {description && <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
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
      <label htmlFor={id} className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
        {label}{required && <span className="text-red-500 ms-0.5">*</span>}
      </label>
      <input
        id={id} name={name} type={type} defaultValue={defaultValue}
        required={required} autoComplete={autoComplete}
        className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 transition-colors placeholder:text-stone-400"
      />
      {hint && <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1">{hint}</p>}
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
      <label htmlFor={id} className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
        {label}{required && <span className="text-red-500 ms-0.5">*</span>}
      </label>
      <div className="relative">
        <input
          id={id} name={name} type={show ? "text" : "password"}
          autoComplete={autoComplete} required={required}
          className="w-full px-3 py-2 pe-10 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 end-0 flex items-center px-3 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
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
      <label htmlFor={id} className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">{label}</label>
      <select
        id={id} name={name} defaultValue={defaultValue}
        className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-700 transition-colors"
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
      <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        {state.success}
      </div>
    );
  }
  if (allErrors.length > 0) {
    return (
      <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
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
      className="flex items-center gap-2 px-4 py-2 bg-emerald-900 dark:bg-emerald-800 text-amber-100 rounded-lg text-xs font-semibold hover:bg-emerald-800 dark:hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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

  return (
    <SectionCard
      icon={UserPlus}
      title="Add Admin User"
      description="Create a new admin or editor account. They will be able to sign in immediately."
    >
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-900 dark:bg-emerald-800 text-amber-100 rounded-lg text-xs font-semibold hover:bg-emerald-800 dark:hover:bg-emerald-700 transition-colors cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
          Add new admin
        </button>
      ) : (
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <StatusMessage state={state} />
          <div className="flex items-center gap-3 pt-1">
            <SubmitButton label="Create admin" pendingLabel="Creating…" pending={pending} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
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
        <ul className="divide-y divide-stone-100 dark:divide-stone-800 -mx-6">
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
    <li className="flex items-center gap-4 px-6 py-3 hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors">
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
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
              You
            </span>
          )}
        </div>
        <p className="text-xs text-stone-400 dark:text-stone-500 truncate">{user.email}</p>
      </div>
      {/* Role badge */}
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${roleColor}`}>
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
