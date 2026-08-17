"use client";

import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldAlert } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function UpdatePasswordPage() {
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
    if (password.length < 8) { setError("Password must be at least 8 characters / 密码至少 8 位"); return; }
    if (password !== confirmation) { setError("Passwords do not match / 两次密码不一致"); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setLoading(false); return; }
    await supabase.auth.signOut();
    setComplete(true);
    setLoading(false);
  }

  return <main className="password-page"><section className="password-card">
    <div className="password-brand"><span>现</span><strong>现场通 <small>OnSite</small></strong></div>
    {complete ? <div className="password-result"><CheckCircle2 size={42} /><h1>密码已更新</h1><p>Your password has been updated securely.</p><Link href="/">返回登录 / Back to login</Link></div>
      : invalid ? <div className="password-result invalid"><ShieldAlert size={42} /><h1>链接无效或已过期</h1><p>This recovery link is invalid or has expired. Request a new link from your administrator.</p><Link href="/">返回登录 / Back to login</Link></div>
      : <>
        <div className="password-heading"><KeyRound size={23} /><p>ACCOUNT RECOVERY</p><h1>设置新密码</h1><span>Choose a new password for your OnSite account.</span></div>
        <form onSubmit={submit}>
          <label htmlFor="new-password">新密码 / New password</label>
          <div className="field-wrap"><KeyRound size={18} /><input id="new-password" name="password" type={show ? "text" : "password"} minLength={8} required autoComplete="new-password" /><button className="password-toggle" type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          <label htmlFor="confirm-password">确认密码 / Confirm password</label>
          <div className="field-wrap"><KeyRound size={18} /><input id="confirm-password" name="confirmation" type={show ? "text" : "password"} minLength={8} required autoComplete="new-password" /></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={!ready || loading}>{loading ? "正在更新…" : "更新密码 / Update password"}</button>
        </form>
      </>}
  </section></main>;
}
