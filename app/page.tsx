"use client";

import { ArrowRight, Eye, EyeOff, Languages, LockKeyhole, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    secure: "安全连接",
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
    secure: "Secure connection",
    language: "Español",
    error: "Enter your username and password",
    loginError: "Login failed. Check your username and password.",
    loading: "Signing in…",
  },
  es: {
    eyebrow: "ASISTENCIA EN CAMPO E INFORMES",
    headline: "Registra tu llegada en segundos.",
    subhead: "Registros de campo sencillos, fiables y auditables.",
    username: "Usuario",
    usernameHint: "Ingresa tu usuario",
    password: "Contraseña",
    passwordHint: "Ingresa tu contraseña",
    login: "Iniciar sesión",
    secure: "Conexión segura",
    language: "한국어",
    error: "Ingresa tu usuario y contraseña",
    loginError: "No se pudo iniciar sesión. Revisa tus datos.",
    loading: "Iniciando sesión…",
  },
  ko: {
    eyebrow: "현장 출퇴근 및 보고",
    headline: "몇 초 만에 현장 출근을 기록하세요.",
    subhead: "간단하고 신뢰할 수 있으며 감사 가능한 현장 기록입니다.",
    username: "사용자 이름",
    usernameHint: "사용자 이름 입력",
    password: "비밀번호",
    passwordHint: "비밀번호 입력",
    login: "로그인",
    secure: "보안 연결",
    language: "中文",
    error: "사용자 이름과 비밀번호를 입력하세요",
    loginError: "로그인하지 못했습니다. 계정 정보를 확인하세요.",
    loading: "로그인 중…",
  },
} as const;

export default function Home() {
  const { locale, toggleLanguage } = useLanguage();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const t = copy[locale];

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (query.has("code") || hash.get("type") === "recovery") {
      window.location.replace(`/auth/update-password${window.location.search}${window.location.hash}`);
    }
  }, []);

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
      router.replace(`${result.role === "ADMIN" ? "/admin" : "/worker"}?lang=${locale}`);
      router.refresh();
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
          aria-label={locale === "zh" ? "Switch to English" : locale === "en" ? "Cambiar a español" : locale === "es" ? "한국어로 전환" : "切换到中文"}
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
            <h2>{locale === "zh" ? "欢迎回来" : locale === "en" ? "Welcome back" : locale === "es" ? "Bienvenido de nuevo" : "다시 오신 것을 환영합니다"}</h2>
            <p>{locale === "zh" ? "使用管理员分配的账号登录" : locale === "en" ? "Use the account assigned by your administrator" : locale === "es" ? "Usa la cuenta asignada por tu administrador" : "관리자가 할당한 계정으로 로그인하세요"}</p>
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
