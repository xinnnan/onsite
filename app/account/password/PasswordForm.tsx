"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Languages, LoaderCircle, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/app/lib/use-language";

const content = {
  zh: {
    account: "账户安全", title: "修改登录密码", subtitle: "为确保账户安全，请先验证当前密码。",
    current: "当前密码", next: "新密码", confirm: "确认新密码", hint: "新密码至少 8 位，并且不能与当前密码相同。",
    submit: "更新密码", updating: "正在更新…", back: "返回", language: "English",
    success: "密码已更新", successHelp: "账户已安全退出，正在返回登录页面…",
    invalidCurrent: "当前密码不正确，请重新输入。", mismatch: "两次输入的新密码不一致。",
    samePassword: "新密码不能与当前密码相同。", invalid: "请填写完整信息，新密码至少 8 位。",
    failed: "密码更新失败，请稍后重试。",
  },
  en: {
    account: "Account security", title: "Change login password", subtitle: "Verify your current password before setting a new one.",
    current: "Current password", next: "New password", confirm: "Confirm new password", hint: "Use at least 8 characters and choose a password different from your current one.",
    submit: "Update password", updating: "Updating…", back: "Back", language: "中文",
    success: "Password updated", successHelp: "You have been signed out securely. Returning to login…",
    invalidCurrent: "The current password is incorrect.", mismatch: "The new passwords do not match.",
    samePassword: "The new password must be different from the current password.", invalid: "Complete all fields and use at least 8 characters.",
    failed: "We could not update your password. Try again.",
  },
} as const;

type Props = { displayName: string; role: "ADMIN" | "WORKER" };

export default function PasswordForm({ displayName, role }: Props) {
  const router = useRouter();
  const { locale, toggleLanguage } = useLanguage();
  const t = content[locale];
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const home = role === "ADMIN" ? "/admin" : "/worker";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      current_password: String(form.get("current_password") || ""),
      new_password: String(form.get("new_password") || ""),
      confirm_password: String(form.get("confirm_password") || ""),
    };
    if (!payload.current_password || payload.new_password.length < 8 || payload.confirm_password.length < 8) {
      setError(t.invalid);
      return;
    }
    if (payload.new_password !== payload.confirm_password) {
      setError(t.mismatch);
      return;
    }
    if (payload.current_password === payload.new_password) {
      setError(t.samePassword);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.replace("/");
          return;
        }
        if (result.error === "INVALID_CURRENT_PASSWORD") setError(t.invalidCurrent);
        else if (result.error === "PASSWORD_CONFIRMATION_MISMATCH") setError(t.mismatch);
        else if (result.error === "NEW_PASSWORD_MUST_BE_DIFFERENT") setError(t.samePassword);
        else if (result.error === "INVALID_PASSWORD_INPUT") setError(t.invalid);
        else setError(t.failed);
        return;
      }

      await fetch("/api/auth/logout", { method: "POST" });
      setComplete(true);
      window.setTimeout(() => { router.replace("/"); router.refresh(); }, 1200);
    } catch {
      setError(t.failed);
    } finally {
      setLoading(false);
    }
  }

  return <main className="password-page account-password-page"><section className="password-card">
    <header className="account-password-top"><Link href={home}><ArrowLeft size={17} />{t.back}</Link><button type="button" onClick={toggleLanguage}><Languages size={16} />{t.language}</button></header>
    <div className="password-brand"><span>现</span><strong>现场通 <small>OnSite</small></strong></div>
    {complete ? <div className="password-result"><CheckCircle2 size={42} /><h1>{t.success}</h1><p>{t.successHelp}</p><LoaderCircle className="spin" size={21} /></div> : <>
      <div className="password-heading"><ShieldCheck size={24} /><p>{t.account.toUpperCase()}</p><h1>{t.title}</h1><span>{displayName} · {t.subtitle}</span></div>
      <form onSubmit={submit}>
        <label htmlFor="current-password">{t.current}</label>
        <div className="field-wrap"><KeyRound size={18} /><input id="current-password" name="current_password" type={showCurrent ? "text" : "password"} maxLength={128} required autoComplete="current-password" /><button className="password-toggle" type="button" onClick={() => setShowCurrent(!showCurrent)} aria-label={showCurrent ? "Hide password" : "Show password"}>{showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        <label htmlFor="account-new-password">{t.next}</label>
        <div className="field-wrap"><KeyRound size={18} /><input id="account-new-password" name="new_password" type={showNew ? "text" : "password"} minLength={8} maxLength={128} required autoComplete="new-password" /><button className="password-toggle" type="button" onClick={() => setShowNew(!showNew)} aria-label={showNew ? "Hide password" : "Show password"}>{showNew ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        <label htmlFor="account-confirm-password">{t.confirm}</label>
        <div className="field-wrap"><KeyRound size={18} /><input id="account-confirm-password" name="confirm_password" type={showNew ? "text" : "password"} minLength={8} maxLength={128} required autoComplete="new-password" /></div>
        <p className="password-help">{t.hint}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={17} />{t.updating}</> : t.submit}</button>
      </form>
    </>}
  </section></main>;
}
