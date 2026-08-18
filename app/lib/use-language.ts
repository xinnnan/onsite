"use client";

import { useEffect, useState } from "react";

export type Locale = "zh" | "en" | "es" | "ko";

export const localeSequence: Locale[] = ["zh", "ko", "en", "es"];

const htmlLocales: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en",
  es: "es",
  ko: "ko",
};

export const intlLocales: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en-US",
  es: "es-ES",
  ko: "ko-KR",
};

function isLocale(value: string | null): value is Locale {
  return localeSequence.includes(value as Locale);
}

export function useLanguage() {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("lang");
    const saved = window.localStorage.getItem("onsite-language");
    const next = isLocale(requested) ? requested : isLocale(saved) ? saved : "zh";
    const timer = window.setTimeout(() => setLocaleState(next), 0);
    window.localStorage.setItem("onsite-language", next);
    document.documentElement.lang = htmlLocales[next];
    return () => window.clearTimeout(timer);
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem("onsite-language", next);
    document.documentElement.lang = htmlLocales[next];
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(window.history.state, "", url);
  }

  return { locale, setLocale };
}
