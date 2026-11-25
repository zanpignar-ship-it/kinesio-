"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, cx, inputClass, Label } from "./ui";
import type { ActionState } from "@/server/action";

const FieldErrors = createContext<Record<string, string>>({});

export function ActionForm({
  action, children, className, resetOnSuccess, onSuccess,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
  }, [state, resetOnSuccess, onSuccess]);
  return (
    <FieldErrors.Provider value={state?.fieldErrors ?? {}}>
      <form ref={ref} action={formAction} className={className} noValidate>
        {state?.error && (
          <div role="alert" className="mb-4 rounded-sm border border-bad/25 bg-bad-soft px-3 py-2.5 text-sm text-bad">
            {state.error}
          </div>
        )}
        {state?.ok && state.message && (
          <div role="status" className="mb-4 rounded-sm border border-ok/25 bg-ok-soft px-3 py-2.5 text-sm text-ok">
            {state.message}
          </div>
        )}
        {children}
      </form>
    </FieldErrors.Provider>
  );
}

export function Field({ name, label, hint, className, children, ...input }: ComponentProps<"input"> & { name: string; label: string; hint?: string; children?: ReactNode }) {
  const errors = useContext(FieldErrors);
  const err = errors[input.id ?? name] ?? errors[name];
  const id = input.id ?? `f-${name}`;
  return (
    <div className={className}>
      <Label htmlFor={id} hint={hint}>{label}</Label>
      {children ?? <input id={id} name={name} aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined} className={inputClass} {...input} />}
      {err && <p id={`${id}-err`} className="mt-1 text-xs text-bad">{err}</p>}
    </div>
  );
}

export function SelectField({ name, label, hint, options, className, ...rest }: ComponentProps<"select"> & { name: string; label: string; hint?: string; options: { value: string; label: string }[] }) {
  const errors = useContext(FieldErrors);
  const err = errors[name];
  const id = rest.id ?? `f-${name}`;
  return (
    <div className={className}>
      <Label htmlFor={id} hint={hint}>{label}</Label>
      <select id={id} name={name} aria-invalid={!!err} className={cx(inputClass, "appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-8")}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5l3 3 3-3' fill='none' stroke='%235c646e' stroke-width='1.5'/%3E%3C/svg%3E\")" }} {...rest}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {err && <p className="mt-1 text-xs text-bad">{err}</p>}
    </div>
  );
}

export function TextareaField({ name, label, hint, className, ...rest }: ComponentProps<"textarea"> & { name: string; label: string; hint?: string }) {
  const errors = useContext(FieldErrors);
  const id = rest.id ?? `f-${name}`;
  return (
    <div className={className}>
      <Label htmlFor={id} hint={hint}>{label}</Label>
      <textarea id={id} name={name} className={cx(inputClass, "h-auto min-h-24 py-2")} {...rest} />
      {errors[name] && <p className="mt-1 text-xs text-bad">{errors[name]}</p>}
    </div>
  );
}

export function CheckboxField({ name, label, defaultChecked, description }: { name: string; label: string; defaultChecked?: boolean; description?: string }) {
  const errors = useContext(FieldErrors);
  const err = errors[name];
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 rounded-sm py-1">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} aria-invalid={!!err} className="mt-0.5 size-4 accent-[var(--ink)]" />
        <span className="text-sm">
          <span className="font-medium text-ink">{label}</span>
          {description && <span className="block text-steel">{description}</span>}
        </span>
      </label>
      {err && <p className="mt-1 text-xs text-bad">{err}</p>}
    </div>
  );
}

export function Submit({ children, variant = "primary", size = "md", className, pendingLabel }: { children: ReactNode; variant?: Parameters<typeof buttonClass>[0]; size?: Parameters<typeof buttonClass>[1]; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={cx(buttonClass(variant, size), className)}>
      {pending && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {pending ? pendingLabel ?? children : children}
    </button>
  );
}
