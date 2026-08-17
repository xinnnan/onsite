"use client";

import { useEffect, useState } from "react";

export type Locale = "zh" | "en";

export function useLanguage() {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("lang");
    const saved = window.localStorage.getItem("onsite-language");
    const next = requested === "en" || requested === "zh" ? requested : saved === "en" || saved === "zh" ? saved : "zh";
    const timer = window.setTimeout(() => setLocaleState(next), 0);
    window.localStorage.setItem("onsite-language", next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    return () => window.clearTimeout(timer);
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem("onsite-language", next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
  }

  return { locale, setLocale, toggleLanguage: () => setLocale(locale === "zh" ? "en" : "zh") };
}
