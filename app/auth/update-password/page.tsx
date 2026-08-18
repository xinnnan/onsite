"use client";

import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, KeyRound, Languages, ShieldAlert } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/app/lib/use-language";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const copy = {
  zh: { language:"English", updated:"密码已更新", updatedHelp:"您的密码已安全更新。", invalid:"链接无效或已过期", invalidHelp:"此恢复链接无效或已过期，请联系管理员申请新链接。", back:"返回登录", eyebrow:"账户恢复", title:"设置新密码", subtitle:"为您的现场通账户设置一个新密码。", password:"新密码", confirm:"确认密码", short:"密码至少需要 8 位。", mismatch:"两次输入的密码不一致。", failed:"密码更新失败，请重试。", updating:"正在更新…", submit:"更新密码" },
  en: { language:"Español", updated:"Password updated", updatedHelp:"Your password has been updated securely.", invalid:"Invalid or expired link", invalidHelp:"This recovery link is invalid or has expired. Request a new link from your administrator.", back:"Back to login", eyebrow:"Account recovery", title:"Set a new password", subtitle:"Choose a new password for your OnSite account.", password:"New password", confirm:"Confirm password", short:"Password must be at least 8 characters.", mismatch:"The passwords do not match.", failed:"We could not update the password. Try again.", updating:"Updating…", submit:"Update password" },
  es: { language:"한국어", updated:"Contraseña actualizada", updatedHelp:"Tu contraseña se actualizó de forma segura.", invalid:"Enlace inválido o vencido", invalidHelp:"Este enlace de recuperación no es válido o ha vencido. Solicita uno nuevo al administrador.", back:"Volver al inicio de sesión", eyebrow:"Recuperación de cuenta", title:"Crear nueva contraseña", subtitle:"Elige una nueva contraseña para tu cuenta de OnSite.", password:"Nueva contraseña", confirm:"Confirmar contraseña", short:"La contraseña debe tener al menos 8 caracteres.", mismatch:"Las contraseñas no coinciden.", failed:"No pudimos actualizar la contraseña. Inténtalo de nuevo.", updating:"Actualizando…", submit:"Actualizar contraseña" },
  ko: { language:"中文", updated:"비밀번호가 변경되었습니다", updatedHelp:"비밀번호가 안전하게 변경되었습니다.", invalid:"유효하지 않거나 만료된 링크", invalidHelp:"복구 링크가 유효하지 않거나 만료되었습니다. 관리자에게 새 링크를 요청하세요.", back:"로그인으로 돌아가기", eyebrow:"계정 복구", title:"새 비밀번호 설정", subtitle:"OnSite 계정에 사용할 새 비밀번호를 선택하세요.", password:"새 비밀번호", confirm:"비밀번호 확인", short:"비밀번호는 8자 이상이어야 합니다.", mismatch:"비밀번호가 일치하지 않습니다.", failed:"비밀번호를 변경하지 못했습니다. 다시 시도하세요.", updating:"변경 중…", submit:"비밀번호 변경" },
} as const;

export default function UpdatePasswordPage() {
  const { locale, toggleLanguage } = useLanguage();
  const t = copy[locale];
  const supabase = useMemo(() => {
    try { return createSupabaseBrowserClient(); } catch { return null; }
  }, []);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(!supabase);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    async function establishSession() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) await supabase!.auth.exchangeCodeForSession(code);
      const { data } = await supabase!.auth.getSession();
      if (active) {
        setReady(Boolean(data.session));
        setInvalid(!data.session);
      }
    }
    establishSession();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) { setReady(true); setInvalid(false); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (password.length < 8) { setError(t.short); return; }
    if (password !== confirmation) { setError(t.mismatch); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError(t.failed); setLoading(false); return; }
    await supabase.auth.signOut();
    setComplete(true);
    setLoading(false);
  }

  return <main className="password-page"><section className="password-card">
    <div className="recovery-language"><button type="button" onClick={toggleLanguage}><Languages size={16}/>{t.language}</button></div>
    <div className="password-brand"><span>现</span><strong>现场通 <small>OnSite</small></strong></div>
    {complete ? <div className="password-result"><CheckCircle2 size={42} /><h1>{t.updated}</h1><p>{t.updatedHelp}</p><Link href="/">{t.back}</Link></div>
      : invalid ? <div className="password-result invalid"><ShieldAlert size={42} /><h1>{t.invalid}</h1><p>{t.invalidHelp}</p><Link href="/">{t.back}</Link></div>
      : <>
        <div className="password-heading"><KeyRound size={23} /><p>{t.eyebrow.toUpperCase()}</p><h1>{t.title}</h1><span>{t.subtitle}</span></div>
        <form onSubmit={submit}>
          <label htmlFor="new-password">{t.password}</label>
          <div className="field-wrap"><KeyRound size={18} /><input id="new-password" name="password" type={show ? "text" : "password"} minLength={8} required autoComplete="new-password" /><button className="password-toggle" type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          <label htmlFor="confirm-password">{t.confirm}</label>
          <div className="field-wrap"><KeyRound size={18} /><input id="confirm-password" name="confirmation" type={show ? "text" : "password"} minLength={8} required autoComplete="new-password" /></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={!ready || loading}>{loading ? t.updating : t.submit}</button>
        </form>
      </>}
  </section></main>;
}
