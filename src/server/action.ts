import "server-only";
import { ZodError } from "zod";
import { DomainError } from "./errors";
import { InvalidTransitionError } from "@/domain/state-machine";
import { t, isMessageKey } from "@/i18n";

export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; message?: string } | null;

/** Converts thrown errors into a user-facing, localized action result. Unknown errors are logged, never leaked. */
export function toActionState(e: unknown): ActionState {
  if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e; // redirects
  if (e instanceof DomainError) {
    const vars = Object.fromEntries(Object.entries(e.details ?? {}).map(([k, v]) => [k, String(v)]));
    return { error: isMessageKey(e.code) ? t(e.code, vars) : t("common.unexpected") };
  }
  if (e instanceof InvalidTransitionError) return { error: `Prehod iz stanja »${e.from}« v »${e.to}« ni dovoljen.` };
  if (e instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of e.issues) {
      const key = issue.path.join(".") || "_";
      fieldErrors[key] ??= isMessageKey(issue.message) ? t(issue.message) : "Neveljavna vrednost.";
    }
    return { error: t("common.invalid"), fieldErrors };
  }
  console.error("[action] unexpected error", e);
  return { error: t("common.unexpected") };
}

export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
