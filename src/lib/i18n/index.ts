import de from "./de";
import en from "./en";

export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";
export const LOCALE_COOKIE = "ww-locale";

export type TKey = keyof typeof de;
export type Vars = Record<string, string | number>;

const dictionaries: Record<Locale, Record<TKey, string>> = { de, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function translate(locale: Locale, key: TKey, vars?: Vars): string {
  let text = dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

export function dictionary(locale: Locale): Record<TKey, string> {
  return dictionaries[locale];
}

export function intlLocale(locale: Locale): string {
  return locale === "de" ? "de-AT" : "en-GB";
}

export function formatDate(date: Date | string, locale: Locale, withTime = false): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "Europe/Vienna",
  }).format(new Date(date));
}

export type Translator = (key: TKey, vars?: Vars) => string;

export function translator(locale: Locale): Translator {
  return (key, vars) => translate(locale, key, vars);
}
