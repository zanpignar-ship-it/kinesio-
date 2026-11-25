import { sl, type MessageKey } from "./sl";
import { en } from "./en";

export const LOCALES = ["sl", "en", "de", "hr"] as const;
export type Locale = (typeof LOCALES)[number];

const catalogs: Record<Locale, Partial<Record<MessageKey, string>>> = { sl, en, de: {}, hr: {} };

export type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function getT(locale: Locale = "sl"): T {
  const cat = catalogs[locale] ?? sl;
  return (key, vars) => {
    let s = cat[key] ?? sl[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

export const t = getT("sl");

export function isMessageKey(k: string): k is MessageKey {
  return k in sl;
}

export const intlLocale: Record<Locale, string> = { sl: "sl-SI", en: "en-GB", de: "de-DE", hr: "hr-HR" };
