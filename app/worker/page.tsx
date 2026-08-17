"use client";

import Link from "next/link";
import { Building2, Camera, CheckCircle2, ChevronRight, Clock3, HardHat, Languages, LogOut, MapPin, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useLanguage } from "@/app/lib/use-language";

const content = {
  zh: {
    greeting: "你好，John",
    role: "现场工程师",
    date: "2026 年 8 月 17 日 · 星期一",
    choose: "选择今日项目",
    assigned: "已分配 2 个在建项目",
    selected: "已选择",
    status: "当前状态",
    idle: "尚未签到",
    idleHelp: "请选择项目，然后拍照签到。",
    checkIn: "拍照签到",
    checkedIn: "工作中",
    since: "签到时间",
    duration: "当前工时",
    checkOut: "拍照签退",
    locked: "工作期间项目已锁定",
    privacy: "不获取 GPS · 时间以服务器为准",
    logout: "退出",
    switchLanguage: "English",
  },
  en: {
    greeting: "Hello, John",
    role: "Field Engineer",
    date: "Monday · August 17, 2026",
    choose: "Choose today’s project",
    assigned: "2 active projects assigned",
    selected: "Selected",
    status: "Current status",
    idle: "Not checked in",
    idleHelp: "Choose a project, then take a selfie to check in.",
    checkIn: "Take selfie & check in",
    checkedIn: "Currently working",
    since: "Checked in",
    duration: "Current duration",
    checkOut: "Take selfie & check out",
    locked: "Project locked during this session",
    privacy: "No GPS · Official time comes from the server",
    logout: "Log out",
    switchLanguage: "中文",
  },
} as const;

const projects = [
  { id: "adidas", name: "adidas Indy AMR", customer: "adidas", location: "Indianapolis, IN", tone: "mint" },
  { id: "walmart", name: "Walmart Atlanta", customer: "Walmart", location: "Norcross, GA", tone: "sand" },
];

function WorkerDashboard() {
  const params = useSearchParams();
  const { locale, toggleLanguage } = useLanguage();
  const t = content[locale];
  const working = params.get("state") === "working";
  const [selected, setSelected] = useState("adidas");
  const [elapsed, setElapsed] = useState(7 * 3600 + 32 * 60);

  useEffect(() => {
    if (!working) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [working]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const chosen = projects.find((project) => project.id === selected) ?? projects[0];

  return (
    <main className="worker-shell">
      <header className="worker-topbar">
        <Link href="/" className="worker-logo" aria-label="OnSite home">
          <span>现</span><strong>现场通 <small>OnSite</small></strong>
        </Link>
        <div className="worker-actions">
          <button type="button" onClick={toggleLanguage}><Languages size={16} />{t.switchLanguage}</button>
          <Link href="/" aria-label={t.logout}><LogOut size={18} /></Link>
        </div>
      </header>

      <section className="worker-content">
        <div className="worker-intro">
          <div className="worker-avatar">JS<span /></div>
          <div>
            <p className="worker-date">{t.date}</p>
            <h1>{t.greeting}</h1>
            <p className="worker-role"><HardHat size={15} /> {t.role}</p>
          </div>
        </div>

        {!working && (
          <section className="project-picker">
            <div className="section-heading">
              <div><p>01</p><h2>{t.choose}</h2></div>
              <span>{t.assigned}</span>
            </div>
            <div className="project-stack">
              {projects.map((project) => (
                <button
                  className={`project-option ${selected === project.id ? "active" : ""}`}
                  type="button"
                  key={project.id}
                  onClick={() => setSelected(project.id)}
                >
                  <span className={`project-icon ${project.tone}`}><Building2 size={22} /></span>
                  <span className="project-info"><strong>{project.name}</strong><small><MapPin size={13} />{project.customer} · {project.location}</small></span>
                  {selected === project.id ? <span className="selected-badge"><CheckCircle2 size={15} />{t.selected}</span> : <ChevronRight size={19} />}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className={`status-card ${working ? "working" : "idle"}`}>
          <div className="status-card-head">
            <div><p>02</p><h2>{t.status}</h2></div>
            <span className="live-pill"><i />{working ? t.checkedIn : t.idle}</span>
          </div>

          {working ? (
            <>
              <div className="active-project">
                <span className="project-icon mint"><Building2 size={23} /></span>
                <div><small>{chosen.customer}</small><strong>{chosen.name}</strong><span><MapPin size={13} /> {chosen.location}</span></div>
                <ShieldCheck size={24} />
              </div>
              <div className="time-grid">
                <div><span>{t.since}</span><strong>08:03 <small>AM</small></strong></div>
                <div><span>{t.duration}</span><strong>{hours}<small>h</small> {String(minutes).padStart(2, "0")}<small>m</small></strong></div>
              </div>
              <p className="lock-note"><Clock3 size={15} />{t.locked}</p>
            </>
          ) : (
            <div className="idle-message">
              <span><Clock3 size={25} /></span>
              <div><strong>{t.idle}</strong><p>{t.idleHelp}</p></div>
            </div>
          )}

          <Link className={`check-action ${working ? "checkout" : ""}`} href={`/worker/camera?type=${working ? "out" : "in"}&project=${selected}&lang=${locale}`}>
            <span className="camera-icon"><Camera size={23} /></span>
            <strong>{working ? t.checkOut : t.checkIn}</strong>
            <ChevronRight size={22} />
          </Link>
        </section>

        <p className="privacy-note"><ShieldCheck size={15} /> {t.privacy}</p>
      </section>
    </main>
  );
}

export default function WorkerPage() {
  return <Suspense><WorkerDashboard /></Suspense>;
}
