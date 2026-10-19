"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { translate, type Locale, type TKey, type Translator, type Vars } from "./index";

const LocaleContext = createContext<Locale>("de");

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT(): Translator {
  const locale = useLocale();
  return useMemo(() => (key: TKey, vars?: Vars) => translate(locale, key, vars), [locale]);
}
