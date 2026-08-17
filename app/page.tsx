"use client";

import { ArrowRight, Eye, EyeOff, Languages, LockKeyhole, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { useLanguage } from "@/app/lib/use-language";

const copy = {
  zh: {
    eyebrow: "现场签到与项目报告",
    headline: "几秒完成现场签到。",
    subhead: "简单、可靠、可审计的现场人员记录。",
    username: "用户名",
    usernameHint: "请输入用户名",
    password: "密码",
    passwordHint: "请输入密码",
    login: "登录",
    secure: "安全连接 · 不获取 GPS 位置",
    language: "English",
    error: "请输入用户名和密码",
    loginError: "登录失败，请检查用户名和密码",
    loading: "正在登录…",
  },
  en: {
    eyebrow: "FIELD ATTENDANCE & REPORTING",
    headline: "Check in on site in seconds.",
    subhead: "Simple, reliable and auditable field records.",
    username: "Username",
    usernameHint: "Enter your username",
    password: "Password",
    passwordHint: "Enter your password",
    login: "Log in",
    secure: "Secure connection · No GPS tracking",
    language: "中文",
    error: "Enter your username and password",
    loginError: "Login failed. Check your username and password.",
    loading: "Signing in…",
  },
} as const;

export default function Home() {
  const { locale, toggleLanguage } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const t = copy[locale];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!form.get("username") || !form.get("password")) {
      setError(t.error);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const result = await response.json() as { role?: "ADMIN" | "WORKER" };
      if (!response.ok) throw new Error("LOGIN_FAILED");
      window.location.href = `${result.role === "ADMIN" ? "/admin" : "/worker"}?lang=${locale}`;
    } catch {
      setError(t.loginError);
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="brand-panel" aria-label={t.eyebrow}>
        <div className="brand-mark"><span>现</span></div>
        <div className="brand-copy">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.headline}</h1>
          <p>{t.subhead}</p>
        </div>
        <div className="brand-orbit" aria-hidden="true">
          <span className="orbit-dot orbit-dot-one" />
          <span className="orbit-dot orbit-dot-two" />
          <span className="orbit-dot orbit-dot-three" />
        </div>
      </section>

      <section className="login-panel">
        <button
          className="language-switch"
          type="button"
          onClick={toggleLanguage}
          aria-label={locale === "zh" ? "Switch to English" : "切换到中文"}
        >
          <Languages size={17} /> {t.language}
        </button>

        <div className="login-card">
          <div className="mobile-brand">
            <div className="brand-mark small"><span>现</span></div>
            <strong>现场通 <em>OnSite</em></strong>
          </div>
          <div className="login-heading">
            <p className="eyebrow">{t.eyebrow}</p>
            <h2>{locale === "zh" ? "欢迎回来" : "Welcome back"}</h2>
            <p>{locale === "zh" ? "使用管理员分配的账号登录" : "Use the account assigned by your administrator"}</p>
          </div>

          <form onSubmit={submit} noValidate>
            <label htmlFor="username">{t.username}</label>
            <div className="field-wrap">
              <UserRound size={19} />
              <input id="username" name="username" autoComplete="username" placeholder={t.usernameHint} onChange={() => setError("")} />
            </div>

            <label htmlFor="password">{t.password}</label>
            <div className="field-wrap">
              <LockKeyhole size={19} />
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder={t.passwordHint} onChange={() => setError("")} />
              <button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit" disabled={loading}>
              <span>{loading ? t.loading : t.login}</span><ArrowRight size={19} />
            </button>
          </form>
          <p className="secure-note"><LockKeyhole size={14} /> {t.secure}</p>
        </div>
      </section>
    </main>
  );
}
