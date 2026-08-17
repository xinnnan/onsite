"use client";

import Link from "next/link";
import { Check, Clock3, MapPin, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useLanguage } from "@/app/lib/use-language";

const copy = {
  zh: { inTitle: "签到成功", outTitle: "签退成功", inSub: "今天的工作时段已经开始", outSub: "今天的工作时段已完成", project: "项目", official: "服务器时间", record: "记录编号", back: "返回首页", secure: "照片与项目快照已安全保存", total: "本次工时" },
  en: { inTitle: "Check-in complete", outTitle: "Check-out complete", inSub: "Your work session has started", outSub: "Your work session is complete", project: "Project", official: "Server time", record: "Record ID", back: "Back to home", secure: "Photo and project snapshot saved securely", total: "Session duration" },
} as const;

function SuccessContent() {
  const params = useSearchParams();
  const { locale } = useLanguage();
  const t = copy[locale];
  const out = params.get("type") === "out";
  const record = params.get("record") || "ATT-PENDING";
  const timestamp = params.get("time") ? new Date(params.get("time")!) : new Date();
  const duration = Number(params.get("duration") || 0);
  const projectName = params.get("project_name") || (params.get("project") === "walmart" ? "Walmart Atlanta" : "Selected project");
  const timeText = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(timestamp);

  return (
    <main className="success-page">
      <section className="success-card">
        <div className="success-mark"><span><Check size={34} strokeWidth={3} /></span><i /><i /></div>
        <p className="success-eyebrow">{out ? "CHECK OUT" : "CHECK IN"} · COMPLETE</p>
        <h1>{out ? t.outTitle : t.inTitle}</h1>
        <p className="success-subtitle">{out ? t.outSub : t.inSub}</p>

        <div className="success-details">
          <div><span><MapPin size={16} />{t.project}</span><strong>{projectName}</strong></div>
          <div><span><Clock3 size={16} />{t.official}</span><strong>{timeText}</strong></div>
          <div><span><ShieldCheck size={16} />{t.record}</span><strong>{record}</strong></div>
        </div>

        {out && duration > 0 && <p className="success-duration">{t.total}: {Math.floor(duration / 3600)}h {Math.floor((duration % 3600) / 60)}m</p>}

        <Link className="success-home" href={out ? `/worker?lang=${locale}` : `/worker?state=working&lang=${locale}`}>{t.back}</Link>
        <p className="success-safe"><ShieldCheck size={14} />{t.secure}</p>
      </section>
    </main>
  );
}

export default function SuccessPage() {
  return <Suspense><SuccessContent /></Suspense>;
}
