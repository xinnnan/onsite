"use client";

import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowDownToLine, Bell, Building2, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, Clock3, FileBarChart,
  FileClock, FileText, Languages, LayoutDashboard, MapPin, Menu, MoreHorizontal,
  Plus, Search, ShieldCheck, SlidersHorizontal, Users, UserRoundCheck, X,
} from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/app/lib/use-language";

export type AdminView = "dashboard" | "users" | "projects" | "project-detail" | "assignments" | "attendance" | "attendance-detail" | "reports" | "audit";

const text = {
  zh: {
    admin: "管理中心", dashboard: "概览", users: "人员管理", projects: "项目管理", assignments: "项目分配", attendance: "考勤记录", reports: "报告中心", audit: "审计日志", search: "搜索人员、项目或记录…", language: "English", today: "今天 · 2026 年 8 月 17 日", overview: "今日现场一览", overviewSub: "实时掌握项目现场人员与异常情况。", addWorker: "新建人员", addProject: "新建项目", filter: "筛选", export: "导出", active: "进行中", complete: "已完成", missing: "缺少签退", currently: "当前在场", inToday: "今日签到", outToday: "今日签退", sessions: "完整工时段", exceptions: "异常记录", live: "实时", weekHours: "本周工时", byDay: "按天统计 · 小时", onSite: "当前现场人员", all: "查看全部", recent: "最近考勤记录", worker: "人员", project: "项目", checkIn: "签到", checkOut: "签退", hours: "工时", status: "状态", customer: "客户", site: "现场", address: "地址", map: "地图", action: "操作", role: "类型 / 公司", lastActive: "最近活动", assigned: "分配项目", edit: "编辑", activeProjects: "在建项目", projectCode: "项目编号", reportTitle: "生成客户项目报告", reportSub: "选择项目与报告期间，生成可审计的 Excel 或 PDF 文件。", period: "报告期间", include: "包含签到/签退照片", preview: "报告摘要预览", personnel: "现场人员", workDays: "工作日", totalHours: "总工时", incomplete: "不完整记录", pdf: "生成 PDF", excel: "导出 Excel", csv: "下载 CSV", auditTitle: "管理员操作记录", auditSub: "所有关键修改都保留原因和修改前后内容。", reason: "修改原因", details: "查看详情", projectInfo: "项目信息", mapUpload: "项目地图截图", replace: "上传 / 替换", save: "保存项目", attendanceTitle: "考勤记录", attendanceSub: "按项目、人员与日期查询现场记录。", date: "日期", company: "公司", view: "查看", assignedWorkers: "已分配人员", availableWorkers: "可分配人员", searchWorker: "搜索人员", photos: "现场照片", total: "合计", serverTime: "服务器时间", recordId: "记录编号", snapshot: "项目快照", menu: "菜单" },
  en: {
    admin: "Admin center", dashboard: "Overview", users: "Workers", projects: "Projects", assignments: "Assignments", attendance: "Attendance", reports: "Reports", audit: "Audit log", search: "Search people, projects or records…", language: "中文", today: "Today · August 17, 2026", overview: "Today on site", overviewSub: "A live view of field personnel and exceptions.", addWorker: "Add worker", addProject: "Add project", filter: "Filter", export: "Export", active: "Active", complete: "Complete", missing: "Missing checkout", currently: "Currently on site", inToday: "Checked in today", outToday: "Checked out today", sessions: "Complete sessions", exceptions: "Exceptions", live: "Live", weekHours: "Hours this week", byDay: "By day · hours", onSite: "Currently on site", all: "View all", recent: "Recent attendance", worker: "Worker", project: "Project", checkIn: "Check in", checkOut: "Check out", hours: "Hours", status: "Status", customer: "Customer", site: "Site", address: "Address", map: "Map", action: "Action", role: "Type / Company", lastActive: "Last active", assigned: "Assigned projects", edit: "Edit", activeProjects: "Active projects", projectCode: "Project code", reportTitle: "Create customer project report", reportSub: "Choose a project and reporting period to create an auditable Excel or PDF file.", period: "Reporting period", include: "Include check-in / check-out photos", preview: "Report summary preview", personnel: "Personnel", workDays: "Work days", totalHours: "Total hours", incomplete: "Incomplete", pdf: "Create PDF", excel: "Export Excel", csv: "Download CSV", auditTitle: "Administrator activity", auditSub: "Every material change keeps the reason and before/after values.", reason: "Reason", details: "View details", projectInfo: "Project information", mapUpload: "Project map screenshot", replace: "Upload / replace", save: "Save project", attendanceTitle: "Attendance records", attendanceSub: "Find field records by project, worker and date.", date: "Date", company: "Company", view: "View", assignedWorkers: "Assigned workers", availableWorkers: "Available workers", searchWorker: "Search workers", photos: "Field photos", total: "Total", serverTime: "Server time", recordId: "Record ID", snapshot: "Project snapshot", menu: "Menu" },
} as const;

const nav = [
  ["dashboard", "/admin", LayoutDashboard], ["users", "/admin/users", Users], ["projects", "/admin/projects", Building2],
  ["assignments", "/admin/assignments", UserRoundCheck], ["attendance", "/admin/attendance", ClipboardCheck],
  ["reports", "/admin/reports", FileBarChart], ["audit", "/admin/audit-logs", FileClock],
] as const;

const people = [
  { initials: "JS", name: "John Smith", company: "DropLetAI", type: "Employee", color: "green", project: "adidas Indy AMR", since: "08:03 AM", status: "active" },
  { initials: "MC", name: "Mike Chen", company: "Vector Systems", type: "Contractor", color: "blue", project: "adidas Indy AMR", since: "07:55 AM", status: "active" },
  { initials: "CG", name: "Carlos Garcia", company: "BuildRight", type: "Subcontractor", color: "orange", project: "Walmart Atlanta", since: "08:17 AM", status: "active" },
  { initials: "AK", name: "Aisha Khan", company: "DropLetAI", type: "Employee", color: "purple", project: "Nike Memphis", since: "08:41 AM", status: "active" },
];

const sessions = [
  { date: "Aug 17", worker: "John Smith", project: "adidas Indy AMR", start: "08:03", end: "—", hours: "—", status: "active" },
  { date: "Aug 17", worker: "Mike Chen", project: "adidas Indy AMR", start: "07:55", end: "17:14", hours: "9.32", status: "complete" },
  { date: "Aug 17", worker: "Carlos Garcia", project: "Walmart Atlanta", start: "08:17", end: "—", hours: "—", status: "missing" },
  { date: "Aug 16", worker: "Aisha Khan", project: "Nike Memphis", start: "08:41", end: "16:52", hours: "8.18", status: "complete" },
];

const projectRows = [
  { id: "adidas-indy", code: "ADI-AMR-26", name: "adidas Indy AMR", customer: "adidas", site: "Indy Manufacturing Facility", address: "Indianapolis, IN", workers: 8, status: "active", tone: "green" },
  { id: "walmart-atlanta", code: "WMT-ATL-04", name: "Walmart Atlanta", customer: "Walmart", site: "ATL Distribution Center", address: "Norcross, GA", workers: 5, status: "active", tone: "sand" },
  { id: "nike-memphis", code: "NKE-MEM-12", name: "Nike Memphis", customer: "Nike", site: "Memphis Logistics Hub", address: "Memphis, TN", workers: 4, status: "active", tone: "blue" },
  { id: "amazon-cmh", code: "AMZ-CMH-08", name: "Amazon CMH Conveyor", customer: "Amazon", site: "CMH Fulfillment Center", address: "Etna, OH", workers: 0, status: "complete", tone: "gray" },
];

function StatusBadge({ status, t }: { status: string; t: typeof text.zh | typeof text.en }) {
  const label = status === "complete" ? t.complete : status === "missing" ? t.missing : status === "active" ? t.active : status;
  return <span className={`status-badge ${status}`}><i />{label}</span>;
}

function MapThumb({ tone = "green" }: { tone?: string }) {
  return <span className={`map-thumb ${tone}`} aria-label="Project map"><i /><i /><i /><b><MapPin size={13} /></b></span>;
}

export default function AdminShell({ view }: { view: AdminView }) {
  const { locale, toggleLanguage } = useLanguage();
  const t = text[locale];
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const activeNav = view === "project-detail" ? "projects" : view === "attendance-detail" ? "attendance" : view;
  const title = t[activeNav as keyof typeof t] || t.dashboard;

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  }

  function downloadCsv() {
    const header = "Date,Worker,Project,Check In,Check Out,Hours,Status\n";
    const rows = sessions.map((row) => `${row.date},${row.worker},${row.project},${row.start},${row.end},${row.hours},${row.status}`).join("\n");
    const url = URL.createObjectURL(new Blob([header + rows], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "onsite-attendance-2026-08-17.csv";
    link.click();
    URL.revokeObjectURL(url);
    flash(locale === "zh" ? "CSV 已下载" : "CSV downloaded");
  }

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${menuOpen ? "open" : ""}`}>
        <div className="admin-brand"><span>现</span><div><strong>现场通</strong><small>ONSITE</small></div><button type="button" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
        <div className="admin-label">{t.admin}</div>
        <nav>
          {nav.map(([key, href, Icon]) => (
            <Link key={key} href={href} className={activeNav === key ? "active" : ""} onClick={() => setMenuOpen(false)}><Icon size={18} /><span>{t[key]}</span>{activeNav === key && <i />}</Link>
          ))}
        </nav>
        <div className="sidebar-user"><span>AL</span><div><strong>Alex Lee</strong><small>Administrator</small></div><MoreHorizontal size={18} /></div>
      </aside>
      {menuOpen && <button className="menu-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="menu-button" type="button" onClick={() => setMenuOpen(true)}><Menu size={20} /><span>{t.menu}</span></button>
          <div className="admin-search"><Search size={18} /><input placeholder={t.search} /></div>
          <div className="admin-actions"><button type="button" onClick={toggleLanguage}><Languages size={16} /><span>{t.language}</span></button><button className="notification" type="button"><Bell size={18} /><i /></button></div>
        </header>

        <div className="admin-page">
          <div className="page-title-row"><div><p>{t.today}</p><h1>{title}</h1></div>{(view === "dashboard" || view === "users") && <button className="admin-primary" type="button" onClick={() => flash(t.addWorker)}><Plus size={17} />{t.addWorker}</button>}{view === "projects" && <button className="admin-primary" type="button" onClick={() => flash(t.addProject)}><Plus size={17} />{t.addProject}</button>}</div>

          {view === "dashboard" && <Dashboard t={t} />}
          {view === "users" && <UsersView t={t} flash={flash} />}
          {view === "projects" && <ProjectsView t={t} />}
          {view === "project-detail" && <ProjectDetail t={t} flash={flash} />}
          {view === "assignments" && <AssignmentsView t={t} flash={flash} />}
          {view === "attendance" && <AttendanceView t={t} downloadCsv={downloadCsv} />}
          {view === "attendance-detail" && <AttendanceDetail t={t} />}
          {view === "reports" && <ReportsView t={t} downloadCsv={downloadCsv} flash={flash} />}
          {view === "audit" && <AuditView t={t} />}
        </div>
      </main>
      {notice && <div className="toast"><CheckCircle2 size={18} />{notice}</div>}
    </div>
  );
}

type T = typeof text.zh | typeof text.en;

function Dashboard({ t }: { t: T }) {
  const stats = [
    [t.currently, "12", "+3", Users, "green"], [t.inToday, "18", "+12%", UserRoundCheck, "blue"],
    [t.outToday, "6", "33%", Clock3, "sand"], [t.sessions, "16", "+8%", CheckCircle2, "purple"], [t.exceptions, "2", t.missing, AlertTriangle, "red"],
  ] as const;
  return <>
    <section className="welcome-strip"><div><p>{t.overview}</p><h2>{t.overviewSub}</h2></div><span><i />{t.live}</span></section>
    <section className="stat-grid">{stats.map(([label, value, note, Icon, tone]) => <article className="stat-card" key={label}><div className={`stat-icon ${tone}`}><Icon size={19} /></div><span>{label}</span><strong>{value}</strong><small className={tone === "red" ? "danger" : ""}>{note}</small></article>)}</section>
    <section className="dashboard-grid">
      <article className="admin-card chart-card"><div className="card-heading"><div><p>{t.weekHours}</p><span>{t.byDay}</span></div><button><CalendarDays size={15} />Aug 11–17<ChevronDown size={14} /></button></div><div className="bar-chart"><div className="axis"><span>120</span><span>80</span><span>40</span><span>0</span></div>{[63,78,54,88,96,34,70].map((height, index) => <div className="bar-column" key={index}><div><i style={{ height: `${height}%` }} /></div><span>{["M","T","W","T","F","S","S"][index]}</span></div>)}</div></article>
      <article className="admin-card onsite-card"><div className="card-heading"><div><p>{t.onSite}</p><span>12 {t.personnel}</span></div><Link href="/admin/attendance">{t.all}<ChevronRight size={14} /></Link></div><div className="onsite-list">{people.slice(0,3).map((person) => <div key={person.name}><span className={`person-avatar ${person.color}`}>{person.initials}<i /></span><div><strong>{person.name}</strong><small>{person.project}</small></div><time>{person.since}</time></div>)}</div></article>
    </section>
    <RecentSessions t={t} />
  </>;
}

function RecentSessions({ t }: { t: T }) {
  return <article className="admin-card table-card"><div className="card-heading"><div><p>{t.recent}</p><span>{t.today}</span></div><Link href="/admin/attendance">{t.all}<ChevronRight size={14} /></Link></div><div className="table-scroll"><table><thead><tr><th>{t.date}</th><th>{t.worker}</th><th>{t.project}</th><th>{t.checkIn}</th><th>{t.checkOut}</th><th>{t.hours}</th><th>{t.status}</th><th /></tr></thead><tbody>{sessions.map((row, i) => <tr key={i}><td>{row.date}</td><td><strong>{row.worker}</strong></td><td>{row.project}</td><td className="mono">{row.start}</td><td className="mono">{row.end}</td><td className="mono">{row.hours}</td><td><StatusBadge status={row.status} t={t} /></td><td><Link href="/admin/attendance/ATT-000123" aria-label={t.view}><ChevronRight size={17} /></Link></td></tr>)}</tbody></table></div></article>;
}

function Toolbar({ t, action }: { t: T; action?: React.ReactNode }) {
  return <div className="toolbar"><div className="toolbar-search"><Search size={16} /><input placeholder={t.search} /></div><button><SlidersHorizontal size={15} />{t.filter}</button>{action}</div>;
}

function UsersView({ t, flash }: { t: T; flash: (message: string) => void }) {
  return <><Toolbar t={t} /><article className="admin-card table-card"><div className="table-scroll"><table><thead><tr><th>{t.worker}</th><th>{t.role}</th><th>{t.assigned}</th><th>{t.lastActive}</th><th>{t.status}</th><th>{t.action}</th></tr></thead><tbody>{people.map((person, i) => <tr key={person.name}><td><div className="person-cell"><span className={`person-avatar ${person.color}`}>{person.initials}<i /></span><div><strong>{person.name}</strong><small>{["john01","mike.chen","cgarcia","aisha.k"][i]}</small></div></div></td><td><strong>{person.type}</strong><small className="cell-sub">{person.company}</small></td><td><span className="count-chip">{[2,1,2,1][i]} {t.activeProjects}</span></td><td>{i === 2 ? "Aug 16, 05:42 PM" : t.today.split(" · ")[0] + ", " + person.since}</td><td><StatusBadge status="active" t={t} /></td><td><button className="text-button" onClick={() => flash(`${t.edit}: ${person.name}`)}>{t.edit}</button></td></tr>)}</tbody></table></div></article></>;
}

function ProjectsView({ t }: { t: T }) {
  return <><Toolbar t={t} /><article className="admin-card table-card"><div className="table-scroll"><table><thead><tr><th>{t.project}</th><th>{t.customer}</th><th>{t.site}</th><th>{t.address}</th><th>{t.map}</th><th>{t.worker}</th><th>{t.status}</th><th /></tr></thead><tbody>{projectRows.map((row) => <tr key={row.id}><td><div className="project-cell"><strong>{row.name}</strong><small>{row.code}</small></div></td><td>{row.customer}</td><td>{row.site}</td><td><span className="address-cell"><MapPin size={14} />{row.address}</span></td><td><MapThumb tone={row.tone} /></td><td><span className="count-chip">{row.workers}</span></td><td><StatusBadge status={row.status} t={t} /></td><td><Link href={`/admin/projects/${row.id}`}><ChevronRight size={17} /></Link></td></tr>)}</tbody></table></div></article></>;
}

function ProjectDetail({ t, flash }: { t: T; flash: (message: string) => void }) {
  const fields = [[t.projectCode,"ADI-AMR-26"],[t.project,"adidas Indy AMR"],[t.customer,"adidas"],[t.site,"Indy Manufacturing Facility"],[t.address,"8677 Impact Court"],["City","Indianapolis"],["State","IN"],["ZIP","46219"],["Timezone","America/Indiana/Indianapolis"]];
  return <div className="detail-layout"><article className="admin-card form-card"><div className="card-heading"><div><p>{t.projectInfo}</p><span>Last updated Aug 12, 2026</span></div><StatusBadge status="active" t={t} /></div><div className="form-grid">{fields.map(([label,value],i) => <label key={label} className={i === 4 || i === 8 ? "wide" : ""}><span>{label}</span><input defaultValue={value} /></label>)}</div><button className="admin-primary save-button" onClick={() => flash(t.save)}><CheckCircle2 size={17} />{t.save}</button></article><article className="admin-card map-card"><div className="card-heading"><div><p>{t.mapUpload}</p><span>WEBP · 1200 × 840</span></div></div><div className="map-preview-large"><div className="map-grid-lines" /><span className="road r1" /><span className="road r2" /><span className="road r3" /><b><MapPin size={23} /></b><label>8677 Impact Court<small>Indianapolis, IN</small></label></div><button className="secondary-button" onClick={() => flash(t.replace)}><ArrowDownToLine size={16} />{t.replace}</button><p className="map-disclaimer"><ShieldCheck size={14} />Project site only · Not worker GPS location</p></article></div>;
}

function AssignmentsView({ t, flash }: { t: T; flash: (message: string) => void }) {
  return <div className="assignment-grid"><article className="admin-card assignment-panel"><div className="card-heading"><div><p>{t.availableWorkers}</p><span>24 total</span></div></div><div className="toolbar-search compact"><Search size={15} /><input placeholder={t.searchWorker} /></div><div className="assignment-list">{people.map((person) => <button key={person.name}><span className={`person-avatar ${person.color}`}>{person.initials}</span><div><strong>{person.name}</strong><small>{person.company}</small></div><Plus size={17} /></button>)}</div></article><article className="admin-card assignment-panel"><div className="assignment-project"><MapThumb /><div><small>ADI-AMR-26</small><strong>adidas Indy AMR</strong></div></div><div className="card-heading"><div><p>{t.assignedWorkers}</p><span>8 active</span></div></div><div className="assignment-list">{people.slice(0,3).map((person) => <button key={person.name}><span className={`person-avatar ${person.color}`}>{person.initials}</span><div><strong>{person.name}</strong><small>{person.type}</small></div><X size={16} /></button>)}</div><button className="admin-primary full" onClick={() => flash(t.save)}>{t.save}</button></article></div>;
}

function AttendanceView({ t, downloadCsv }: { t: T; downloadCsv: () => void }) {
  return <><p className="page-description">{t.attendanceSub}</p><div className="filter-grid"><label>{t.customer}<select defaultValue="all"><option value="all">All customers</option><option>adidas</option><option>Walmart</option></select></label><label>{t.project}<select defaultValue="all"><option value="all">All projects</option><option>adidas Indy AMR</option></select></label><label>{t.worker}<select defaultValue="all"><option value="all">All workers</option><option>John Smith</option></select></label><label>{t.date}<input type="date" defaultValue="2026-08-17" /></label><button onClick={downloadCsv}><ArrowDownToLine size={16} />{t.export}</button></div><RecentSessions t={t} /></>;
}

function AttendanceDetail({ t }: { t: T }) {
  return <><div className="record-hero"><div className="person-cell"><span className="person-avatar green">JS</span><div><p>John Smith</p><span>Employee · DropLetAI</span></div></div><div><span>{t.project}</span><strong>adidas Indy AMR</strong></div><div><span>{t.date}</span><strong>August 17, 2026</strong></div><StatusBadge status="complete" t={t} /></div><div className="photo-grid"><PhotoRecord type="CHECK IN" time="08:03 AM" id="ATT-000123-I" t={t} /><PhotoRecord type="CHECK OUT" time="05:14 PM" id="ATT-000123-O" t={t} /></div><div className="record-footer"><div><span>{t.total}</span><strong>9h 11m</strong></div><div><span>{t.snapshot}</span><strong>8677 Impact Court · Indianapolis, IN 46219</strong></div><div><span>{t.customer}</span><strong>adidas</strong></div></div></>;
}

function PhotoRecord({ type, time, id, t }: { type: string; time: string; id: string; t: T }) {
  return <article className="admin-card photo-record"><div className="photo-placeholder"><div className="photo-person"><span /><i /></div><div className="photo-watermark"><div><strong>DROPLETAI SERVICES</strong><b>{type}</b><span>John Smith · adidas Indy AMR</span><small>Indianapolis, IN · {time} EDT</small></div><MapThumb /></div></div><div className="photo-meta"><div><span>{type}</span><strong>{time}</strong></div><div><span>{t.recordId}</span><strong>{id}</strong></div><div><span>{t.serverTime}</span><strong>Aug 17, 2026</strong></div></div></article>;
}

function ReportsView({ t, downloadCsv, flash }: { t: T; downloadCsv: () => void; flash: (message: string) => void }) {
  return <div className="report-layout"><article className="admin-card report-builder"><div className="report-icon"><FileText size={24} /></div><h2>{t.reportTitle}</h2><p>{t.reportSub}</p><label>{t.project}<select><option>adidas Indy AMR</option><option>Walmart Atlanta</option></select></label><label>{t.period}<div className="date-pair"><input type="date" defaultValue="2026-08-01" /><span>—</span><input type="date" defaultValue="2026-08-31" /></div></label><label className="check-label"><input type="checkbox" defaultChecked /><span><Check size={13} /></span>{t.include}</label><div className="report-actions"><button className="admin-primary" onClick={() => { window.print(); flash(t.pdf); }}><FileText size={16} />{t.pdf}</button><button className="secondary-button" onClick={downloadCsv}><ArrowDownToLine size={16} />{t.excel}</button></div></article><article className="report-preview"><div className="report-paper"><header><div><strong>DROPLETAI</strong><span>SERVICES</span></div><p>SITE ATTENDANCE REPORT</p></header><div className="report-project"><div><span>Customer</span><strong>adidas</strong><span>Project</span><strong>Indy AMR Upgrade</strong><span>Reporting Period</span><strong>August 1–31, 2026</strong></div><MapThumb /></div><h3>{t.preview}</h3><div className="report-stat-grid"><div><span>{t.personnel}</span><b>18</b></div><div><span>{t.workDays}</span><b>22</b></div><div><span>{t.totalHours}</span><b>1,284</b></div><div><span>{t.incomplete}</span><b>2</b></div></div><div className="report-lines">{[74,88,57,82,68].map((width,i) => <i key={i} style={{width:`${width}%`}} />)}</div></div></article></div>;
}

function AuditView({ t }: { t: T }) {
  const logs = [{ action:"WORK_SESSION_UPDATED", user:"Alex Lee", target:"John Smith · Aug 16", reason:"Employee forgot to check out. Confirmed by site supervisor.", time:"10:42 AM" },{ action:"PROJECT_MAP_REPLACED", user:"Alex Lee", target:"adidas Indy AMR", reason:"Updated customer-provided facility map.", time:"09:18 AM" },{ action:"WORKER_DISABLED", user:"Maya Patel", target:"Robert Young", reason:"Contract completed on August 14.", time:"Yesterday" },{ action:"PROJECT_ASSIGNMENT_ADDED", user:"Alex Lee", target:"Aisha Khan → Nike Memphis", reason:"Assigned for commissioning support.", time:"Aug 15" }];
  return <><p className="page-description">{t.auditSub}</p><article className="admin-card audit-list">{logs.map((log,i) => <div className="audit-item" key={log.action}><span className={`audit-icon a${i}`}><Activity size={17} /></span><div><strong>{log.action.replaceAll("_"," ")}</strong><p>{log.user} · {log.target}</p><blockquote><b>{t.reason}:</b> {log.reason}</blockquote></div><time>{log.time}</time></div>)}</article></>;
}
