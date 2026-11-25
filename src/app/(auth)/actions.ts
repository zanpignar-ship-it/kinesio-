"use server";

import { redirect } from "next/navigation";
import { authenticate, createSession, destroySession, registerUser, setActiveOrg } from "@/server/services/identity";
import { clearSessionCookie, clientMeta, getSession, sessionToken, setSessionCookie } from "@/server/session";
import { rateLimit } from "@/server/rate-limit";
import { str, toActionState, type ActionState } from "@/server/action";
import { t } from "@/i18n";

function safeNext(next: string) {
  return next.startsWith("/app") && !next.startsWith("//") ? next : "/app";
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  const meta = await clientMeta();
  if (!rateLimit(`login:${meta.ip}:${email}`, 8, 60_000).ok || !rateLimit(`login-ip:${meta.ip}`, 30, 60_000).ok) return { error: t("auth.rateLimited") };
  let target: string;
  try {
    const user = await authenticate({ email, password: str(fd, "password") });
    const { token } = await createSession(user.id, meta);
    await setSessionCookie(token);
    target = safeNext(str(fd, "next"));
  } catch (e) {
    return toActionState(e);
  }
  redirect(target);
}

export async function signupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const meta = await clientMeta();
  if (!rateLimit(`signup:${meta.ip}`, 5, 60_000).ok) return { error: t("auth.rateLimited") };
  if (str(fd, "password").length < 10) return { error: t("common.invalid"), fieldErrors: { password: t("auth.passwordTooShort") } };
  if (fd.get("terms") !== "on") return { error: t("common.invalid"), fieldErrors: { terms: "Za nadaljevanje potrdite pogoje uporabe." } };
  try {
    const user = await registerUser({ fullName: str(fd, "fullName"), email: str(fd, "email"), password: str(fd, "password") });
    const { token } = await createSession(user.id, meta);
    await setSessionCookie(token);
  } catch (e) {
    return toActionState(e);
  }
  redirect("/app/onboarding");
}

export async function logoutAction() {
  const token = await sessionToken();
  if (token) await destroySession(token);
  await clearSessionCookie();
  redirect("/login");
}

export async function switchOrgAction(fd: FormData) {
  const s = await getSession();
  const token = await sessionToken();
  if (!s || !token) redirect("/login");
  await setActiveOrg(token, str(fd, "orgId"), s.user.id);
  redirect("/app");
}
