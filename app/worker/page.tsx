"use client";

import Link from "next/link";
import { Building2, Camera, CheckCircle2, ChevronRight, Clock3, HardHat, KeyRound, Languages, LoaderCircle, LogOut, MapPin, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/app/lib/use-language";

type WorkerProject = { id: string; project_code: string; project_name: string; customer_name: string; site_name?: string | null; address_line_1?: string; city: string; state?: string | null; postal_code?: string | null; timezone?: string; status: string };
type WorkerSummary = { profile: { display_name: string; worker_type: string; company?: string | null }; projects: WorkerProject[]; session: null | { id: string; check_in_time: string; project_id: string; project: WorkerProject }; today: Array<{ event_type: string; server_timestamp: string }>; demo?: boolean };

const content = {
  zh: { greeting: "你好", role: "现场工程师", choose: "选择今日项目", assigned: "个在建项目", selected: "已选择", status: "当前状态", idle: "尚未签到", idleHelp: "请选择项目，然后拍照签到。", checkIn: "拍照签到", checkedIn: "工作中", since: "签到时间", duration: "当前工时", checkOut: "拍照签退", locked: "工作期间项目已锁定", privacy: "时间以服务器为准", logout: "退出", changePassword: "修改密码", switchLanguage: "English", loadError: "无法加载当前工作状态，请刷新重试。", retry: "重试", noProjects: "暂无已分配的在建项目，请联系管理员。" },
  en: { greeting: "Hello", role: "Field Engineer", choose: "Choose today’s project", assigned: "active projects assigned", selected: "Selected", status: "Current status", idle: "Not checked in", idleHelp: "Choose a project, then take a selfie to check in.", checkIn: "Take selfie & check in", checkedIn: "Currently working", since: "Checked in", duration: "Current duration", checkOut: "Take selfie & check out", locked: "Project locked during this session", privacy: "Official time comes from the server", logout: "Log out", changePassword: "Change password", switchLanguage: "中文", loadError: "We could not load your current work status. Try again.", retry: "Retry", noProjects: "No active projects are assigned. Contact your administrator." },
} as const;

function WorkerDashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const { locale, toggleLanguage } = useLanguage();
  const t = content[locale];
  const [summary, setSummary] = useState<WorkerSummary | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [demoCheckInTime, setDemoCheckInTime] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/worker/summary", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) { router.replace("/"); return; }
      if (!response.ok) throw new Error("LOAD_FAILED");
      const data = await response.json() as WorkerSummary;
      setSummary(data);
      setSelected((current) => current || (data.projects.length === 1 ? data.projects[0]?.id || "" : ""));
      const now = Date.now();
      setTick(now);
      if (data.demo) setDemoCheckInTime(new Date(now - (7 * 3600 + 32 * 60) * 1000).toISOString());
    } catch { setError(t.loadError); }
  }, [router, t.loadError]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { const timer = window.setInterval(() => setTick((value) => value + 1), 1000); return () => window.clearInterval(timer); }, []);

  const demoWorking = summary?.demo && params.get("state") === "working";
  const working = Boolean(summary?.session || demoWorking);
  const projects = summary?.projects || [];
  const chosen = working
    ? summary?.session?.project || projects.find((project) => project.id === selected) || projects[0]
    : projects.find((project) => project.id === selected) || (projects.length === 1 ? projects[0] : undefined);
  const checkInTime = summary?.session?.check_in_time || (demoWorking ? demoCheckInTime : null);
  const elapsed = checkInTime && tick ? Math.max(0, Math.floor((tick - new Date(checkInTime).valueOf()) / 1000)) : 0;
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const initials = (summary?.profile.display_name || "Worker").split(/\s+/).map((part) => part[0]).join("").slice(0,2).toUpperCase();
  const now = new Date();
  const dateText = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(now);

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/"); router.refresh(); }

  return <main className="worker-shell">
    <header className="worker-topbar"><Link href="/worker" className="worker-logo"><span>现</span><strong>现场通 <small>OnSite</small></strong></Link><div className="worker-actions"><Link className="worker-password-link" href="/account/password" aria-label={t.changePassword} title={t.changePassword}><KeyRound size={17} /><span>{t.changePassword}</span></Link><button type="button" onClick={toggleLanguage}><Languages size={16} />{t.switchLanguage}</button><button type="button" onClick={logout} aria-label={t.logout}><LogOut size={18} /></button></div></header>
    <section className="worker-content">
      {error ? <div className="worker-state-message"><ShieldCheck size={30} /><p>{error}</p><button onClick={load}>{t.retry}</button></div> : !summary ? <div className="worker-state-message"><LoaderCircle className="spin" size={30} /><p>Loading…</p></div> : <>
        <div className="worker-intro"><div className="worker-avatar">{initials}<span /></div><div><p className="worker-date">{dateText}</p><h1>{t.greeting}，{summary.profile.display_name}</h1><p className="worker-role"><HardHat size={15} /> {summary.profile.worker_type.replaceAll("_"," ")} · {summary.profile.company || t.role}</p></div></div>
        {!working && <section className="project-picker"><div className="section-heading"><div><p>01</p><h2>{t.choose}</h2></div><span>{projects.length} {t.assigned}</span></div>
          {projects.length === 0 ? <div className="empty-projects">{t.noProjects}</div> : <div className="project-stack">{projects.map((project, index) => <button className={`project-option ${selected === project.id ? "active" : ""}`} type="button" key={project.id} onClick={() => setSelected(project.id)}><span className={`project-icon ${index % 2 ? "sand" : "mint"}`}><Building2 size={22} /></span><span className="project-info"><strong>{project.project_name}</strong><small><MapPin size={13} />{project.customer_name} · {[project.city,project.state].filter(Boolean).join(", ")}</small></span>{selected === project.id ? <span className="selected-badge"><CheckCircle2 size={15} />{t.selected}</span> : <ChevronRight size={19} />}</button>)}</div>}
        </section>}
        <section className={`status-card ${working ? "working" : "idle"}`}><div className="status-card-head"><div><p>02</p><h2>{t.status}</h2></div><span className="live-pill"><i />{working ? t.checkedIn : t.idle}</span></div>
          {working && chosen ? <><div className="active-project"><span className="project-icon mint"><Building2 size={23} /></span><div><small>{chosen.customer_name}</small><strong>{chosen.project_name}</strong><span><MapPin size={13} /> {[chosen.city,chosen.state].filter(Boolean).join(", ")}</span></div><ShieldCheck size={24} /></div><div className="time-grid"><div><span>{t.since}</span><strong>{checkInTime ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { hour:"2-digit",minute:"2-digit" }).format(new Date(checkInTime)) : "—"}</strong></div><div><span>{t.duration}</span><strong>{hours}<small>h</small> {String(minutes).padStart(2,"0")}<small>m</small></strong></div></div><p className="lock-note"><Clock3 size={15} />{t.locked}</p></> : <div className="idle-message"><span><Clock3 size={25} /></span><div><strong>{t.idle}</strong><p>{t.idleHelp}</p></div></div>}
          {chosen && <Link className={`check-action ${working ? "checkout" : ""}`} href={`/worker/camera?type=${working ? "out" : "in"}&project=${chosen.id}&project_name=${encodeURIComponent(chosen.project_name)}&lang=${locale}`}><span className="camera-icon"><Camera size={23} /></span><strong>{working ? t.checkOut : t.checkIn}</strong><ChevronRight size={22} /></Link>}
        </section><p className="privacy-note"><ShieldCheck size={15} /> {t.privacy}</p>
      </>}
    </section>
  </main>;
}

export default function WorkerPage() { return <Suspense><WorkerDashboard /></Suspense>; }
