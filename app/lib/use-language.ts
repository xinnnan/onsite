"use client";

import { useEffect, useState } from "react";

export type Locale = "zh" | "en";

export function useLanguage() {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("lang");
    const saved = window.localStorage.getItem("onsite-language");
    if (requested === "en" || requested === "zh") setLocaleState(requested);
    else if (saved === "en" || saved === "zh") setLocaleState(saved);
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem("onsite-language", next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
  }

  return { locale, setLocale, toggleLanguage: () => setLocale(locale === "zh" ? "en" : "zh") };
}
