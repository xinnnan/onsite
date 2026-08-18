"use client";

import { Languages } from "lucide-react";
import type { Locale } from "@/app/lib/use-language";

const options: Array<{ value: Locale; label: string }> = [
  { value: "zh", label: "中文" },
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

export default function LanguageSelect({ locale, setLocale, className = "" }: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  className?: string;
}) {
  return <label className={`language-select ${className}`.trim()}>
    <Languages size={16} aria-hidden="true" />
    <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} aria-label="选择语言 / Select language">
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
