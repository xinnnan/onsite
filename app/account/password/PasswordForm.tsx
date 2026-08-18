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
    submit: "Update password", updating: "Updating…", back: "Back", language: "Español",
    success: "Password updated", successHelp: "You have been signed out securely. Returning to login…",
    invalidCurrent: "The current password is incorrect.", mismatch: "The new passwords do not match.",
    samePassword: "The new password must be different from the current password.", invalid: "Complete all fields and use at least 8 characters.",
    failed: "We could not update your password. Try again.",
  },
  es: {
    account: "Seguridad de la cuenta", title: "Cambiar contraseña", subtitle: "Verifica tu contraseña actual antes de crear una nueva.",
    current: "Contraseña actual", next: "Nueva contraseña", confirm: "Confirmar nueva contraseña", hint: "Usa al menos 8 caracteres y una contraseña diferente de la actual.",
    submit: "Actualizar contraseña", updating: "Actualizando…", back: "Volver", language: "한국어",
    success: "Contraseña actualizada", successHelp: "La sesión se cerró de forma segura. Volviendo al inicio de sesión…",
    invalidCurrent: "La contraseña actual es incorrecta.", mismatch: "Las nuevas contraseñas no coinciden.",
    samePassword: "La nueva contraseña debe ser diferente de la actual.", invalid: "Completa todos los campos y usa al menos 8 caracteres.",
    failed: "No pudimos actualizar la contraseña. Inténtalo de nuevo.",
  },
  ko: {
    account: "계정 보안", title: "로그인 비밀번호 변경", subtitle: "새 비밀번호를 설정하기 전에 현재 비밀번호를 확인합니다.",
    current: "현재 비밀번호", next: "새 비밀번호", confirm: "새 비밀번호 확인", hint: "8자 이상이며 현재 비밀번호와 다른 비밀번호를 사용하세요.",
    submit: "비밀번호 변경", updating: "변경 중…", back: "돌아가기", language: "中文",
    success: "비밀번호가 변경되었습니다", successHelp: "안전하게 로그아웃했습니다. 로그인 화면으로 이동 중…",
    invalidCurrent: "현재 비밀번호가 올바르지 않습니다.", mismatch: "새 비밀번호가 일치하지 않습니다.",
    samePassword: "새 비밀번호는 현재 비밀번호와 달라야 합니다.", invalid: "모든 항목을 입력하고 8자 이상을 사용하세요.",
    failed: "비밀번호를 변경하지 못했습니다. 다시 시도하세요.",
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
