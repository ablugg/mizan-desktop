"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Locale, TranslationKey, getT } from "@/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
  isRTL: false,
});

export function LocaleProvider({
  children,
  defaultLocale,
}: {
  children: React.ReactNode;
  defaultLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  // On mount, check localStorage for user override
  useEffect(() => {
    const stored = localStorage.getItem("mizan-locale") as Locale | null;
    if (stored === "ar" || stored === "en") {
      setLocaleState(stored);
    }
  }, []);

  // Sync html dir/lang when locale changes
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("mizan-locale", newLocale);
  }, []);

  const t = useCallback((key: TranslationKey) => getT(locale)(key), [locale]);

  return (
    <LocaleContext.Provider
      value={{ locale, setLocale, t, isRTL: locale === "ar" }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
