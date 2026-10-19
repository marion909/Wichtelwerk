import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, translator, type Locale } from "./index";

export async function getLocale(): Promise<Locale> {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(stored)) return stored;
  const accept = (await headers()).get("accept-language")?.toLowerCase() ?? "";
  const first = accept.split(",")[0]?.trim().slice(0, 2);
  return isLocale(first) ? first : DEFAULT_LOCALE;
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: translator(locale) };
}
