"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element -- Joined rows vary; signed private images cannot use the Next image optimizer. */

import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowDownToLine, Bell, Building2, CalendarDays, CheckCircle2,
  ChevronDown, ChevronRight, ClipboardCheck, Clock3, FileBarChart, FileClock, FileText,
  KeyRound, Languages, LayoutDashboard, LoaderCircle, LocateFixed, MapPin, Menu, MoreHorizontal, Plus,
  Search, SlidersHorizontal, Upload, Users, UserRoundCheck, X,
} from "lucide-react";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { intlLocales, type Locale, useLanguage } from "@/app/lib/use-language";
import { formatProjectCoordinates } from "@/lib/project-coordinates";
import { DEMO_COMPANY_NAME } from "@/lib/demo";

export type AdminView = "dashboard" | "users" | "projects" | "project-detail" | "assignments" | "attendance" | "attendance-detail" | "reports" | "audit";
type Row = Record<string, any>;
type ModalState = { type: "worker" | "project" | "edit-worker" | "reset" | "correction"; record?: Row } | null;

const text = {
  zh: { admin:"管理中心",dashboard:"概览",users:"人员管理",projects:"项目管理",assignments:"项目分配",attendance:"考勤记录",reports:"报告中心",audit:"审计日志",search:"搜索人员、项目或记录…",language:"English",today:"今天",addWorker:"新建人员",addProject:"新建项目",filter:"筛选",export:"导出",active:"进行中",complete:"已完成",missing:"缺少签退",currently:"当前在场",inToday:"今日签到",outToday:"今日签退",sessions:"完整工时段",exceptions:"异常记录",live:"实时",onSite:"当前现场人员",recent:"最近考勤记录",worker:"人员",project:"项目",checkIn:"签到",checkOut:"签退",hours:"工时",status:"状态",customer:"客户",site:"现场",address:"地址",map:"地图",action:"操作",company:"公司",assigned:"分配项目",edit:"编辑",reset:"重置密码",save:"保存",cancel:"取消",loading:"正在加载…",empty:"暂无记录",loadError:"加载失败，请重试",retry:"重试",projectCode:"项目编号",reportTitle:"生成客户项目报告",period:"报告期间",include:"PDF 包含考勤照片",pdf:"生成 PDF",excel:"导出 Excel",csv:"下载 CSV",auditTitle:"管理员操作记录",reason:"修改原因",details:"查看详情",projectInfo:"项目信息",mapUpload:"项目地图截图",replace:"上传 / 替换",uploadingMap:"正在上传…",uploadMapError:"地图上传失败，请检查图片格式后重试",attendanceTitle:"考勤记录",date:"日期",view:"查看",assignedWorkers:"已分配人员",availableWorkers:"可分配人员",photos:"现场照片",total:"合计",serverTime:"服务器时间",recordId:"记录编号",snapshot:"项目快照",menu:"菜单",logout:"退出",changePassword:"修改密码",create:"创建",password:"临时密码",displayName:"显示名称",username:"用户名",workerType:"人员类型",role:"角色",timezone:"时区",startDate:"开始日期",endDate:"结束日期",correct:"修正记录",downloaded:"文件已下载",saved:"已保存",resetDone:"密码已重置",allPersonnel:"所有人员",runReport:"运行报告",runningReport:"正在生成预览…",reportPreview:"报告预览",reportHint:"选择项目、人员范围和报告期间，然后运行报告查看结果。",reportNotRun:"设置筛选条件后，点击“运行报告”生成预览。",reportFailed:"报告生成失败，请重试",exportOptions:"导出选项",personnelSummary:"人员汇总",dailyAttendance:"每日考勤",workSessions:"工时段",workDays:"工作日",incomplete:"未完成",noReportRows:"当前筛选条件下暂无考勤记录",reportReady:"预览已生成",latitude:"纬度",longitude:"经度",coordinates:"项目参考坐标",workSummary:"今日工作总结",legacySummary:"此历史记录未填写工作总结" },
  en: { admin:"Admin center",dashboard:"Overview",users:"Workers",projects:"Projects",assignments:"Assignments",attendance:"Attendance",reports:"Reports",audit:"Audit log",search:"Search people, projects or records…",language:"Español",today:"Today",addWorker:"Add worker",addProject:"Add project",filter:"Filter",export:"Export",active:"Active",complete:"Complete",missing:"Missing checkout",currently:"Currently on site",inToday:"Checked in today",outToday:"Checked out today",sessions:"Complete sessions",exceptions:"Exceptions",live:"Live",onSite:"Currently on site",recent:"Recent attendance",worker:"Worker",project:"Project",checkIn:"Check in",checkOut:"Check out",hours:"Hours",status:"Status",customer:"Customer",site:"Site",address:"Address",map:"Map",action:"Action",company:"Company",assigned:"Assigned projects",edit:"Edit",reset:"Reset password",save:"Save",cancel:"Cancel",loading:"Loading…",empty:"No records yet",loadError:"Could not load data. Try again.",retry:"Retry",projectCode:"Project code",reportTitle:"Create customer project report",period:"Reporting period",include:"Include attendance photos in PDF",pdf:"Create PDF",excel:"Export Excel",csv:"Download CSV",auditTitle:"Administrator activity",reason:"Reason",details:"View details",projectInfo:"Project information",mapUpload:"Project map screenshot",replace:"Upload / replace",uploadingMap:"Uploading…",uploadMapError:"Map upload failed. Check the image format and try again.",attendanceTitle:"Attendance records",date:"Date",view:"View",assignedWorkers:"Assigned workers",availableWorkers:"Available workers",photos:"Field photos",total:"Total",serverTime:"Server time",recordId:"Record ID",snapshot:"Project snapshot",menu:"Menu",logout:"Log out",changePassword:"Change password",create:"Create",password:"Temporary password",displayName:"Display name",username:"Username",workerType:"Worker type",role:"Role",timezone:"Timezone",startDate:"Start date",endDate:"End date",correct:"Correct record",downloaded:"File downloaded",saved:"Saved",resetDone:"Password reset",allPersonnel:"All personnel",runReport:"Run report",runningReport:"Generating preview…",reportPreview:"Report preview",reportHint:"Select a project, personnel scope, and reporting period, then run the report to review the results.",reportNotRun:"Set the filters, then select Run report to generate a preview.",reportFailed:"Could not generate the report. Try again.",exportOptions:"Export options",personnelSummary:"Personnel summary",dailyAttendance:"Daily attendance",workSessions:"Work sessions",workDays:"Work days",incomplete:"Incomplete",noReportRows:"No attendance records match these filters",reportReady:"Preview ready",latitude:"Latitude",longitude:"Longitude",coordinates:"Project reference coordinates",workSummary:"Today's work summary",legacySummary:"No work summary was recorded for this historical session" },
  es: { admin:"Centro de administración",dashboard:"Resumen",users:"Personal",projects:"Proyectos",assignments:"Asignaciones",attendance:"Asistencia",reports:"Informes",audit:"Registro de auditoría",search:"Buscar personas, proyectos o registros…",language:"한국어",today:"Hoy",addWorker:"Añadir usuario",addProject:"Añadir proyecto",filter:"Filtrar",export:"Exportar",active:"Activo",complete:"Completo",missing:"Falta la salida",currently:"Actualmente en el sitio",inToday:"Entradas de hoy",outToday:"Salidas de hoy",sessions:"Jornadas completas",exceptions:"Excepciones",live:"En vivo",onSite:"Personal actualmente en el sitio",recent:"Asistencia reciente",worker:"Personal",project:"Proyecto",checkIn:"Entrada",checkOut:"Salida",hours:"Horas",status:"Estado",customer:"Cliente",site:"Sitio",address:"Dirección",map:"Mapa",action:"Acción",company:"Empresa",assigned:"Proyectos asignados",edit:"Editar",reset:"Restablecer contraseña",save:"Guardar",cancel:"Cancelar",loading:"Cargando…",empty:"Aún no hay registros",loadError:"No se pudieron cargar los datos. Inténtalo de nuevo.",retry:"Reintentar",projectCode:"Código del proyecto",reportTitle:"Crear informe del proyecto",period:"Período del informe",include:"Incluir fotos de asistencia en el PDF",pdf:"Crear PDF",excel:"Exportar Excel",csv:"Descargar CSV",auditTitle:"Actividad del administrador",reason:"Motivo",details:"Ver detalles",projectInfo:"Información del proyecto",mapUpload:"Imagen del mapa del proyecto",replace:"Subir / reemplazar",uploadingMap:"Subiendo…",uploadMapError:"No se pudo subir el mapa. Revisa el formato de la imagen.",attendanceTitle:"Registros de asistencia",date:"Fecha",view:"Ver",assignedWorkers:"Personal asignado",availableWorkers:"Personal disponible",photos:"Fotos del sitio",total:"Total",serverTime:"Hora del servidor",recordId:"ID del registro",snapshot:"Datos del proyecto",menu:"Menú",logout:"Cerrar sesión",changePassword:"Cambiar contraseña",create:"Crear",password:"Contraseña temporal",displayName:"Nombre visible",username:"Usuario",workerType:"Tipo de personal",role:"Rol",timezone:"Zona horaria",startDate:"Fecha inicial",endDate:"Fecha final",correct:"Corregir registro",downloaded:"Archivo descargado",saved:"Guardado",resetDone:"Contraseña restablecida",allPersonnel:"Todo el personal",runReport:"Ejecutar informe",runningReport:"Generando vista previa…",reportPreview:"Vista previa del informe",reportHint:"Selecciona un proyecto, el personal y el período; luego ejecuta el informe para revisar los resultados.",reportNotRun:"Configura los filtros y selecciona Ejecutar informe para generar una vista previa.",reportFailed:"No se pudo generar el informe. Inténtalo de nuevo.",exportOptions:"Opciones de exportación",personnelSummary:"Resumen del personal",dailyAttendance:"Asistencia diaria",workSessions:"Sesiones de trabajo",workDays:"Días trabajados",incomplete:"Incompletas",noReportRows:"No hay registros que coincidan con estos filtros",reportReady:"Vista previa lista",latitude:"Latitud",longitude:"Longitud",coordinates:"Coordenadas de referencia del proyecto",workSummary:"Resumen del trabajo de hoy",legacySummary:"Esta sesión histórica no tiene un resumen de trabajo" },
  ko: { admin:"관리 센터",dashboard:"개요",users:"인력 관리",projects:"프로젝트",assignments:"프로젝트 배정",attendance:"근태 기록",reports:"보고서",audit:"감사 로그",search:"인력, 프로젝트 또는 기록 검색…",language:"中文",today:"오늘",addWorker:"사용자 추가",addProject:"프로젝트 추가",filter:"필터",export:"내보내기",active:"진행 중",complete:"완료",missing:"퇴근 누락",currently:"현재 현장 근무 중",inToday:"오늘 출근",outToday:"오늘 퇴근",sessions:"완료된 근무 세션",exceptions:"예외",live:"실시간",onSite:"현재 현장 인력",recent:"최근 근태 기록",worker:"인력",project:"프로젝트",checkIn:"출근",checkOut:"퇴근",hours:"시간",status:"상태",customer:"고객",site:"현장",address:"주소",map:"지도",action:"작업",company:"회사",assigned:"배정된 프로젝트",edit:"수정",reset:"비밀번호 재설정",save:"저장",cancel:"취소",loading:"불러오는 중…",empty:"아직 기록이 없습니다",loadError:"데이터를 불러오지 못했습니다. 다시 시도하세요.",retry:"다시 시도",projectCode:"프로젝트 코드",reportTitle:"고객 프로젝트 보고서 생성",period:"보고 기간",include:"PDF에 근태 사진 포함",pdf:"PDF 생성",excel:"Excel 내보내기",csv:"CSV 다운로드",auditTitle:"관리자 활동",reason:"사유",details:"상세 보기",projectInfo:"프로젝트 정보",mapUpload:"프로젝트 지도 이미지",replace:"업로드 / 교체",uploadingMap:"업로드 중…",uploadMapError:"지도를 업로드하지 못했습니다. 이미지 형식을 확인하세요.",attendanceTitle:"근태 기록",date:"날짜",view:"보기",assignedWorkers:"배정된 인력",availableWorkers:"배정 가능한 인력",photos:"현장 사진",total:"합계",serverTime:"서버 시간",recordId:"기록 ID",snapshot:"프로젝트 스냅샷",menu:"메뉴",logout:"로그아웃",changePassword:"비밀번호 변경",create:"생성",password:"임시 비밀번호",displayName:"표시 이름",username:"사용자 이름",workerType:"인력 유형",role:"역할",timezone:"시간대",startDate:"시작일",endDate:"종료일",correct:"기록 수정",downloaded:"파일 다운로드 완료",saved:"저장됨",resetDone:"비밀번호가 재설정됨",allPersonnel:"전체 인력",runReport:"보고서 실행",runningReport:"미리보기 생성 중…",reportPreview:"보고서 미리보기",reportHint:"프로젝트, 인력 범위 및 보고 기간을 선택한 후 보고서를 실행해 결과를 확인하세요.",reportNotRun:"필터를 설정한 후 보고서 실행을 선택해 미리보기를 생성하세요.",reportFailed:"보고서를 생성하지 못했습니다. 다시 시도하세요.",exportOptions:"내보내기 옵션",personnelSummary:"인력 요약",dailyAttendance:"일일 근태",workSessions:"근무 세션",workDays:"근무일",incomplete:"미완료",noReportRows:"필터와 일치하는 근태 기록이 없습니다",reportReady:"미리보기 준비 완료",latitude:"위도",longitude:"경도",coordinates:"프로젝트 기준 좌표",workSummary:"오늘의 작업 요약",legacySummary:"이 이전 근무 기록에는 작업 요약이 없습니다" },
} as const;

const nav = [
  ["dashboard","/admin",LayoutDashboard],["users","/admin/users",Users],["projects","/admin/projects",Building2],
  ["assignments","/admin/assignments",UserRoundCheck],["attendance","/admin/attendance",ClipboardCheck],
  ["reports","/admin/reports",FileBarChart],["audit","/admin/audit-logs",FileClock],
] as const;

const demoPeople = [
  { id:"demo-1",username:"john01",display_name:"John Smith",company:DEMO_COMPANY_NAME,worker_type:"EMPLOYEE",role:"WORKER",status:"ACTIVE" },
  { id:"demo-2",username:"mike.chen",display_name:"Mike Chen",company:"Vector Systems",worker_type:"CONTRACTOR",role:"WORKER",status:"ACTIVE" },
  { id:"demo-3",username:"cgarcia",display_name:"Carlos Garcia",company:"BuildRight",worker_type:"SUBCONTRACTOR",role:"WORKER",status:"ACTIVE" },
];
const demoProjects = [
  { id:"adidas-indy",project_code:"ADI-AMR-26",project_name:"adidas Indy AMR",customer_name:"adidas",site_name:"Indy Manufacturing Facility",address_line_1:"8677 Impact Court",city:"Indianapolis",state:"IN",postal_code:"46219",country:"United States",timezone:"America/Indiana/Indianapolis",latitude:39.780625,longitude:-86.045711,status:"ACTIVE" },
  { id:"walmart-atlanta",project_code:"WMT-ATL-04",project_name:"Walmart Atlanta",customer_name:"Walmart",site_name:"ATL Distribution Center",address_line_1:"1200 Logistics Pkwy",city:"Norcross",state:"GA",postal_code:"30071",country:"United States",timezone:"America/New_York",latitude:33.941134,longitude:-84.211475,status:"ACTIVE" },
];
const demoSessions = [
  { id:"demo-session-1",check_in_time:"2026-08-17T12:03:00Z",check_out_time:"2026-08-17T21:14:00Z",duration_seconds:33060,status:"COMPLETE",daily_work_summary:"完成 6 台机器人的例行检查，更换 2 个传感器并测试运行状态正常。",worker:demoPeople[0],project:demoProjects[0],check_in_event:{record_code:"ATT-000123-I",project_latitude_snapshot:39.780625,project_longitude_snapshot:-86.045711},check_out_event:{record_code:"ATT-000123-O",project_latitude_snapshot:39.780625,project_longitude_snapshot:-86.045711} },
  { id:"demo-session-2",check_in_time:"2026-08-17T11:55:00Z",check_out_time:null,duration_seconds:null,status:"OPEN",worker:demoPeople[1],project:demoProjects[0],check_in_event:{record_code:"ATT-000124-I"} },
];

type T = (typeof text)[keyof typeof text];

function one(value: any) { return Array.isArray(value) ? value[0] : value; }
function initials(name = "") { return name.split(/\s+/).map((part) => part[0]).join("").slice(0,2).toUpperCase() || "—"; }
function resolveIntlLocale(locale: string) { return locale in intlLocales ? intlLocales[locale as Locale] : locale; }
function formatDate(value?: string, locale = "en-US") { return value ? new Intl.DateTimeFormat(resolveIntlLocale(locale),{month:"short",day:"2-digit",year:"numeric"}).format(new Date(value)) : "—"; }
function formatTime(value?: string, locale = "en-US") { return value ? new Intl.DateTimeFormat(resolveIntlLocale(locale),{hour:"2-digit",minute:"2-digit"}).format(new Date(value)) : "—"; }
function formatHours(seconds?: number | null) { return seconds == null ? "—" : (seconds / 3600).toFixed(2); }

function StatusBadge({ status, t }: { status: string; t: T }) {
  const normalized = status.toLowerCase();
  const label = normalized === "complete" ? t.complete : normalized === "missing_checkout" ? t.missing : normalized === "open" || normalized === "active" ? t.active : status.replaceAll("_"," ");
  return <span className={`status-badge ${normalized === "open" ? "active" : normalized}`}><i />{label}</span>;
}

function PageState({ loading, error, empty, retry, children, t }: { loading:boolean;error:string;empty:boolean;retry:()=>void;children:ReactNode;t:T }) {
  if (loading) return <div className="admin-empty"><LoaderCircle className="spin" size={25}/><p>{t.loading}</p></div>;
  if (error) return <div className="admin-empty"><AlertTriangle size={25}/><p>{error}</p><button onClick={retry}>{t.retry}</button></div>;
  if (empty) return <div className="admin-empty"><ClipboardCheck size={26}/><p>{t.empty}</p></div>;
  return children;
}

export default function AdminShell({ view }: { view: AdminView }) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, toggleLanguage } = useLanguage();
  const t = text[locale];
  const [menuOpen,setMenuOpen] = useState(false);
  const [modal,setModal] = useState<ModalState>(null);
  const [data,setData] = useState<Row>({});
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const id = pathname.split("/").filter(Boolean).at(-1) || "";
  const activeNav = view === "project-detail" ? "projects" : view === "attendance-detail" ? "attendance" : view;

  const endpoint = useMemo(() => {
    if (view === "dashboard") return "/api/admin/dashboard";
    if (view === "users") return "/api/admin/users";
    if (view === "projects") return "/api/admin/projects";
    if (view === "project-detail") return `/api/admin/projects/${id}`;
    if (view === "assignments" || view === "reports") return "/api/admin/project-assignments";
    if (view === "attendance") return "/api/admin/attendance";
    if (view === "attendance-detail") return `/api/admin/attendance/${id}`;
    return "/api/admin/audit-logs";
  }, [id,view]);

  const load = useCallback(async (customEndpoint?: string) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(customEndpoint || endpoint,{cache:"no-store"});
      if (response.status === 401 || response.status === 403) { router.replace("/"); return; }
      if (!response.ok) throw new Error("LOAD_FAILED");
      const payload = await response.json();
      setData(payload);
    } catch { setError(t.loadError); } finally { setLoading(false); }
  },[endpoint,router,t.loadError]);
  useEffect(()=>{const timer=window.setTimeout(()=>{void load()},0);return()=>window.clearTimeout(timer)},[load]);
  function flash(message:string){setNotice(message);window.setTimeout(()=>setNotice(""),2200);}
  async function logout(){await fetch("/api/auth/logout",{method:"POST"});router.replace("/");router.refresh();}

  return <div className="admin-shell">
    <aside className={`admin-sidebar ${menuOpen?"open":""}`}><div className="admin-brand"><span>现</span><div><strong>现场通</strong><small>ONSITE</small></div><button onClick={()=>setMenuOpen(false)}><X size={20}/></button></div><div className="admin-label">{t.admin}</div><nav>{nav.map(([key,href,Icon])=><Link key={key} href={href} className={activeNav===key?"active":""} onClick={()=>setMenuOpen(false)}><Icon size={18}/><span>{t[key]}</span>{activeNav===key&&<i/>}</Link>)}</nav><Link className="sidebar-password" href="/account/password" onClick={()=>setMenuOpen(false)}><KeyRound size={17}/><span>{t.changePassword}</span></Link><button className="sidebar-user" onClick={logout}><span>AL</span><div><strong>Administrator</strong><small>{t.logout}</small></div><MoreHorizontal size={18}/></button></aside>
    {menuOpen&&<button className="menu-scrim" onClick={()=>setMenuOpen(false)}/>}<main className="admin-main"><header className="admin-topbar"><button className="menu-button" onClick={()=>setMenuOpen(true)}><Menu size={20}/><span>{t.menu}</span></button><div className="admin-search"><Search size={18}/><input placeholder={t.search}/></div><div className="admin-actions"><button onClick={toggleLanguage}><Languages size={16}/><span>{t.language}</span></button><button className="notification"><Bell size={18}/><i/></button></div></header>
      <div className="admin-page"><div className="page-title-row"><div><p>{t.today} · {formatDate(new Date().toISOString(),locale)}</p><h1>{t[activeNav as keyof typeof t]}</h1></div>{(view==="dashboard"||view==="users")&&<button className="admin-primary" onClick={()=>setModal({type:"worker"})}><Plus size={17}/>{t.addWorker}</button>}{view==="projects"&&<button className="admin-primary" onClick={()=>setModal({type:"project"})}><Plus size={17}/>{t.addProject}</button>}</div>
        {view==="dashboard"&&<DashboardView data={data} loading={loading} error={error} load={load} t={t} locale={locale}/>}
        {view==="users"&&<UsersView data={data} loading={loading} error={error} load={load} t={t} onEdit={(record)=>setModal({type:"edit-worker",record})} onReset={(record)=>setModal({type:"reset",record})}/>}
        {view==="projects"&&<ProjectsView data={data} loading={loading} error={error} load={load} t={t}/>}
        {view==="project-detail"&&<ProjectDetail data={data} loading={loading} error={error} load={load} t={t} flash={flash}/>}
        {view==="assignments"&&<AssignmentsView data={data} loading={loading} error={error} load={load} t={t} flash={flash}/>}
        {view==="attendance"&&<AttendanceView data={data} loading={loading} error={error} load={load} t={t} locale={locale}/>}
        {view==="attendance-detail"&&<AttendanceDetail data={data} loading={loading} error={error} load={load} t={t} locale={locale} onCorrect={(record)=>setModal({type:"correction",record})}/>}
        {view==="reports"&&<ReportsView data={data} loading={loading} error={error} load={load} t={t} locale={locale} flash={flash}/>}
        {view==="audit"&&<AuditView data={data} loading={loading} error={error} load={load} t={t} locale={locale}/>}
      </div></main>
    {modal&&<AdminModal modal={modal} t={t} close={()=>setModal(null)} saved={()=>{setModal(null);flash(modal.type==="reset"?t.resetDone:t.saved);load();}}/>}
    {notice&&<div className="toast"><CheckCircle2 size={18}/>{notice}</div>}
  </div>;
}

function DashboardView({data,loading,error,load,t,locale}:{data:Row;loading:boolean;error:string;load:()=>void;t:T;locale:string}) {
  const stats=data.stats||{}; const onSite=data.demo?demoSessions.filter((row)=>row.status==="OPEN"):(data.on_site||[]); const recent=data.demo?demoSessions:(data.recent||[]);
  const dailyHours=data.demo?[63,78,54,88,96,34,70]:(data.daily_hours||[]).map((row:Row)=>Number(row.hours||0));const maxHours=Math.max(...dailyHours,1);
  const cards=[[t.currently,stats.currently_on_site??onSite.length,Users,"green"],[t.inToday,stats.checked_in_today??(data.demo?2:0),UserRoundCheck,"blue"],[t.outToday,stats.checked_out_today??(data.demo?1:0),Clock3,"sand"],[t.sessions,stats.complete_sessions??(data.demo?1:0),CheckCircle2,"purple"],[t.missing,stats.missing_checkout??0,FileClock,"sand"],[t.exceptions,stats.exceptions??0,AlertTriangle,"red"]] as const;
  return <PageState loading={loading} error={error} empty={false} retry={load} t={t}><section className="welcome-strip"><div><p>{t.onSite}</p><h2>{t.live}</h2></div><span><i/>{t.live}</span></section><section className="stat-grid">{cards.map(([label,value,Icon,tone])=><article className="stat-card" key={label}><div className={`stat-icon ${tone}`}><Icon size={19}/></div><span>{label}</span><strong>{value}</strong></article>)}</section><section className="dashboard-grid"><article className="admin-card chart-card"><div className="card-heading"><div><p>{t.hours}</p><span>7 days</span></div><button><CalendarDays size={15}/><ChevronDown size={14}/></button></div><div className="bar-chart"><div className="axis"><span>{maxHours.toFixed(0)}</span><span>{(maxHours/2).toFixed(0)}</span><span>0</span></div>{dailyHours.map((hours:number,index:number)=><div className="bar-column" key={index}><div title={`${hours.toFixed(2)} h`}><i style={{height:`${Math.max(hours?5:0,(hours/maxHours)*100)}%`}}/></div><span>{data.demo?["M","T","W","T","F","S","S"][index]:String(data.daily_hours?.[index]?.day||"").slice(5)}</span></div>)}</div></article><article className="admin-card onsite-card"><div className="card-heading"><div><p>{t.onSite}</p><span>{onSite.length}</span></div></div><div className="onsite-list">{onSite.slice(0,3).map((row:Row)=>{const worker=one(row.worker)||{};const project=one(row.project)||{};return <div key={row.id}><span className="person-avatar green">{initials(worker.display_name)}<i/></span><div><strong>{worker.display_name}</strong><small>{project.project_name}</small></div><time>{formatTime(row.check_in_time,locale)}</time></div>})}</div></article></section><SessionTable sessions={recent} t={t} locale={locale}/></PageState>;
}

function SessionTable({sessions,t,locale}:{sessions:Row[];t:T;locale:string}) { return <article className="admin-card table-card"><div className="card-heading"><div><p>{t.recent}</p><span>{sessions.length}</span></div></div><div className="table-scroll"><table><thead><tr><th>{t.date}</th><th>{t.worker}</th><th>{t.project}</th><th>{t.checkIn}</th><th>{t.checkOut}</th><th>{t.hours}</th><th>{t.status}</th><th/></tr></thead><tbody>{sessions.map((row)=>{const worker=one(row.worker)||{};const project=one(row.project)||{};return <tr key={row.id}><td>{formatDate(row.check_in_time,locale)}</td><td><strong>{worker.display_name||"—"}</strong></td><td>{project.project_name||"—"}</td><td className="mono">{formatTime(row.check_in_time,locale)}</td><td className="mono">{formatTime(row.check_out_time,locale)}</td><td className="mono">{formatHours(row.duration_seconds)}</td><td><StatusBadge status={row.status} t={t}/></td><td><Link href={`/admin/attendance/${row.id}`}><ChevronRight size={17}/></Link></td></tr>})}</tbody></table></div></article> }

function UsersView({data,loading,error,load,t,onEdit,onReset}:{data:Row;loading:boolean;error:string;load:()=>void;t:T;onEdit:(r:Row)=>void;onReset:(r:Row)=>void}) { const users=data.demo?demoPeople:(data.users||[]); return <PageState loading={loading} error={error} empty={!users.length} retry={load} t={t}><div className="toolbar"><div className="toolbar-search"><Search size={16}/><input placeholder={t.search}/></div><button><SlidersHorizontal size={15}/>{t.filter}</button></div><article className="admin-card table-card"><div className="table-scroll"><table><thead><tr><th>{t.worker}</th><th>{t.company}</th><th>{t.workerType}</th><th>{t.role}</th><th>{t.status}</th><th>{t.action}</th></tr></thead><tbody>{users.map((user:Row)=><tr key={user.id}><td><div className="person-cell"><span className="person-avatar green">{initials(user.display_name)}<i/></span><div><strong>{user.display_name}</strong><small>{user.username}</small></div></div></td><td>{user.company||"—"}</td><td>{user.worker_type?.replaceAll("_"," ")}</td><td>{user.role}</td><td><StatusBadge status={user.status} t={t}/></td><td><div className="table-actions"><button onClick={()=>onEdit(user)}>{t.edit}</button><button onClick={()=>onReset(user)}>{t.reset}</button></div></td></tr>)}</tbody></table></div></article></PageState> }

function ProjectsView({data,loading,error,load,t}:{data:Row;loading:boolean;error:string;load:()=>void;t:T}) { const projects=data.demo?demoProjects:(data.projects||[]); return <PageState loading={loading} error={error} empty={!projects.length} retry={load} t={t}><div className="toolbar"><div className="toolbar-search"><Search size={16}/><input placeholder={t.search}/></div><button><SlidersHorizontal size={15}/>{t.filter}</button></div><article className="admin-card table-card"><div className="table-scroll"><table><thead><tr><th>{t.project}</th><th>{t.customer}</th><th>{t.site}</th><th>{t.address}</th><th>{t.map}</th><th>{t.assigned}</th><th>{t.status}</th><th/></tr></thead><tbody>{projects.map((row:Row)=><tr key={row.id}><td><div className="project-cell"><strong>{row.project_name}</strong><small>{row.project_code}</small></div></td><td>{row.customer_name}</td><td>{row.site_name||"—"}</td><td><span className="address-cell"><MapPin size={14}/>{[row.city,row.state].filter(Boolean).join(", ")}</span></td><td><Link className="project-map-link" href={`/admin/projects/${row.id}`}>{row.map_url?<img src={row.map_url} alt={t.map}/>:<span className="map-thumb"><MapPin size={14}/></span>}</Link></td><td><span className="count-chip">{(row.project_assignments||[]).filter((a:Row)=>a.status==="ACTIVE").length}</span></td><td><StatusBadge status={row.status} t={t}/></td><td><Link href={`/admin/projects/${row.id}`}><ChevronRight size={17}/></Link></td></tr>)}</tbody></table></div></article></PageState> }

function ProjectDetail({data,loading,error,load,t,flash}:{data:Row;loading:boolean;error:string;load:()=>void;t:T;flash:(s:string)=>void}) {
  const project=data.demo?demoProjects[0]:data.project;
  const mapInputRef=useRef<HTMLInputElement>(null);
  const [uploadingMap,setUploadingMap]=useState(false);
  const [mapUploadError,setMapUploadError]=useState("");

  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const body:Row=Object.fromEntries(form.entries());
    for(const key of ["address_line_2","site_name","state","postal_code","start_date","end_date","latitude","longitude"]){if(body[key]==="")body[key]=null}
    for(const key of ["latitude","longitude"]){if(body[key]!=null)body[key]=Number(body[key])}
    const response=await fetch(`/api/admin/projects/${project.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    if(response.ok){flash(t.saved);load();}
  }

  async function upload(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget;
    setUploadingMap(true);
    setMapUploadError("");
    const response=await fetch(`/api/admin/projects/${project.id}/map`,{method:"POST",body:new FormData(form)});
    if(response.ok){form.reset();flash(t.saved);load();}
    else setMapUploadError(t.uploadMapError);
    setUploadingMap(false);
  }

  const coordinates=formatProjectCoordinates(project?.latitude,project?.longitude);
  return <PageState loading={loading} error={error} empty={!project} retry={load} t={t}>{project&&<div className="detail-layout"><form className="admin-card form-card" onSubmit={save}><div className="card-heading"><div><p>{t.projectInfo}</p><span>{project.project_code}</span></div><StatusBadge status={project.status} t={t}/></div><div className="form-grid"><Field name="project_code" label={t.projectCode} value={project.project_code}/><Field name="project_name" label={t.project} value={project.project_name}/><Field name="customer_name" label={t.customer} value={project.customer_name}/><Field name="site_name" label={t.site} value={project.site_name}/><Field name="address_line_1" label={t.address} value={project.address_line_1} wide/><Field name="address_line_2" label={`${t.address} 2`} value={project.address_line_2} wide/><Field name="city" label="City" value={project.city}/><Field name="state" label="State" value={project.state}/><Field name="postal_code" label="ZIP" value={project.postal_code}/><Field name="country" label="Country" value={project.country}/><Field name="timezone" label={t.timezone} value={project.timezone} wide/><Field name="latitude" label={t.latitude} value={project.latitude} type="number" step="0.000001" min="-90" max="90"/><Field name="longitude" label={t.longitude} value={project.longitude} type="number" step="0.000001" min="-180" max="180"/><Field name="start_date" label={t.startDate} value={project.start_date} type="date"/><Field name="end_date" label={t.endDate} value={project.end_date} type="date"/><label><span>{t.status}</span><select name="status" defaultValue={project.status}><option>ACTIVE</option><option>COMPLETED</option><option>ARCHIVED</option></select></label></div><button className="admin-primary save-button"><CheckCircle2 size={17}/>{t.save}</button></form><article className="admin-card map-card"><div className="card-heading"><div><p>{t.mapUpload}</p><span>PNG · JPG · WEBP</span></div></div><div className="project-map-frame">{project.map_url?<img className="real-map-preview" src={project.map_url} alt={t.map}/>:<div className="map-preview-large"><MapPin size={28}/></div>}{coordinates&&<div className="project-coordinate-overlay"><LocateFixed size={13}/><div><span>{t.coordinates}</span><strong>{coordinates}</strong></div></div>}</div><form onSubmit={upload}><input ref={mapInputRef} name="map" type="file" accept="image/png,image/jpeg,image/webp" required hidden disabled={uploadingMap} onChange={(event)=>{if(event.currentTarget.files?.length)event.currentTarget.form?.requestSubmit();}}/><button className="secondary-button map-upload-trigger" type="button" disabled={uploadingMap} onClick={()=>mapInputRef.current?.click()}>{uploadingMap?<LoaderCircle className="spin" size={16}/>:<Upload size={16}/>} {uploadingMap?t.uploadingMap:t.replace}</button>{mapUploadError&&<p className="map-upload-error" role="alert">{mapUploadError}</p>}</form></article></div>}</PageState>
}

function Field({name,label,value,wide,type="text",step,min,max}:{name:string;label:string;value?:string|number|null;wide?:boolean;type?:string;step?:string;min?:string;max?:string}) { return <label className={wide?"wide":""}><span>{label}</span><input name={name} type={type} step={step} min={min} max={max} defaultValue={value??""}/></label> }

function AssignmentsView({data,loading,error,load,t,flash}:{data:Row;loading:boolean;error:string;load:()=>void;t:T;flash:(s:string)=>void}) { const users=data.demo?demoPeople:(data.users||[]);const projects=data.demo?demoProjects:(data.projects||[]);const assignments=data.assignments||[];const [projectId,setProjectId]=useState("");const activeProjectId=projects.some((project:Row)=>project.id===projectId)?projectId:(projects[0]?.id||"");async function toggle(userId:string,assigned:boolean){const response=await fetch("/api/admin/project-assignments",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({user_id:userId,project_id:activeProjectId,assigned})});if(response.ok){flash(t.saved);load();}}return <PageState loading={loading} error={error} empty={!users.length||!projects.length} retry={load} t={t}><div className="assignment-selector"><label>{t.project}<select value={activeProjectId} onChange={(e)=>setProjectId(e.target.value)}>{projects.map((p:Row)=><option value={p.id} key={p.id}>{p.project_name}</option>)}</select></label></div><div className="assignment-grid"><article className="admin-card assignment-panel"><div className="card-heading"><div><p>{t.availableWorkers}</p><span>{users.length}</span></div></div><div className="assignment-list">{users.map((user:Row)=>{const assigned=assignments.some((a:Row)=>a.user_id===user.id&&a.project_id===activeProjectId&&a.status==="ACTIVE");return <button key={user.id} onClick={()=>toggle(user.id,!assigned)}><span className="person-avatar green">{initials(user.display_name)}</span><div><strong>{user.display_name}</strong><small>{user.company}</small></div>{assigned?<X size={16}/>:<Plus size={17}/>}</button>})}</div></article><article className="admin-card assignment-panel"><div className="card-heading"><div><p>{t.assignedWorkers}</p><span>{assignments.filter((a:Row)=>a.project_id===activeProjectId&&a.status==="ACTIVE").length}</span></div></div><div className="assignment-list">{assignments.filter((a:Row)=>a.project_id===activeProjectId&&a.status==="ACTIVE").map((a:Row)=>{const user=one(a.user)||{};return <button key={a.id} onClick={()=>toggle(a.user_id,false)}><span className="person-avatar green">{initials(user.display_name)}</span><div><strong>{user.display_name}</strong><small>{user.company}</small></div><X size={16}/></button>})}</div></article></div></PageState> }

function AttendanceView({data,loading,error,load,t,locale}:{data:Row;loading:boolean;error:string;load:(u?:string)=>void;t:T;locale:string}) { const sessions=data.demo?demoSessions:(data.sessions||[]);const projects=data.demo?demoProjects:(data.projects||[]);const users=data.demo?demoPeople:(data.users||[]);const customers=[...new Set(projects.map((project:Row)=>project.customer_name).filter(Boolean))];const companies=[...new Set(users.map((user:Row)=>user.company).filter(Boolean))];const all=locale==="zh"?"全部":locale==="es"?"Todos":locale==="ko"?"전체":"All";function filter(event:FormEvent<HTMLFormElement>){event.preventDefault();const values=new FormData(event.currentTarget);const query=new URLSearchParams();values.forEach((value,key)=>{if(value)query.set(key,String(value))});load(`/api/admin/attendance?${query}`)}return <><form className="filter-grid attendance-filters" onSubmit={filter}><label>{t.customer}<select name="customer"><option value="">{all}</option>{customers.map((customer)=><option key={String(customer)}>{String(customer)}</option>)}</select></label><label>{t.project}<select name="project"><option value="">{all}</option>{projects.map((project:Row)=><option key={project.id} value={project.id}>{project.project_name}</option>)}</select></label><label>{t.worker}<select name="worker"><option value="">{all}</option>{users.map((user:Row)=><option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label><label>{t.company}<select name="company"><option value="">{all}</option>{companies.map((company)=><option key={String(company)}>{String(company)}</option>)}</select></label><label>{t.startDate}<input name="start" type="date"/></label><label>{t.endDate}<input name="end" type="date"/></label><label>{t.status}<select name="status"><option value="">{all}</option>{["OPEN","COMPLETE","MISSING_CHECKOUT","LONG_SESSION","MANUALLY_CORRECTED","VOID"].map((status)=><option key={status}>{status}</option>)}</select></label><button><SlidersHorizontal size={16}/>{t.filter}</button></form><PageState loading={loading} error={error} empty={!sessions.length} retry={()=>load()} t={t}><SessionTable sessions={sessions} t={t} locale={locale}/></PageState></> }

function AttendanceDetail({data,loading,error,load,t,locale,onCorrect}:{data:Row;loading:boolean;error:string;load:()=>void;t:T;locale:string;onCorrect:(r:Row)=>void}) { const session=data.demo?demoSessions[0]:data.session;const worker=one(session?.worker)||{};const project=one(session?.project)||{};const inEvent=one(session?.check_in_event)||{};const outEvent=one(session?.check_out_event)||{};const projectName=inEvent.project_name_snapshot||project.project_name;const customerName=inEvent.customer_name_snapshot||project.customer_name;const siteName=inEvent.site_name_snapshot||project.site_name;const projectAddress=inEvent.project_address_snapshot||[project.address_line_1,project.city,project.state,project.postal_code].filter(Boolean).join(", ");const coordinates=formatProjectCoordinates(inEvent.project_latitude_snapshot??project.latitude,inEvent.project_longitude_snapshot??project.longitude);return <PageState loading={loading} error={error} empty={!session} retry={load} t={t}>{session&&<><div className="record-hero"><div className="person-cell"><span className="person-avatar green">{initials(worker.display_name)}</span><div><p>{worker.display_name}</p><span>{worker.company}</span></div></div><div><span>{t.project}</span><strong>{projectName}</strong></div><div><span>{t.date}</span><strong>{formatDate(session.check_in_time,locale)}</strong></div><StatusBadge status={session.status} t={t}/></div><div className="photo-grid"><PhotoRecord type={t.checkIn} event={inEvent} url={session.check_in_photo_url} t={t} locale={locale}/><PhotoRecord type={t.checkOut} event={outEvent} url={session.check_out_photo_url} t={t} locale={locale}/></div><div className="record-footer"><div><span>{t.total}</span><strong>{formatHours(session.duration_seconds)} h</strong></div><div><span>{t.customer}</span><strong>{customerName||"—"}</strong></div><div><span>{t.site}</span><strong>{siteName||"—"}</strong></div><div><span>{t.snapshot}</span><strong>{projectAddress}</strong></div><div><span>{t.coordinates}</span><strong>{coordinates||"—"}</strong></div><div><button className="admin-primary" onClick={()=>onCorrect(session)}>{t.correct}</button></div></div><article className="admin-card work-summary-record"><header><FileText size={17}/><span>{t.workSummary}</span></header><p className={session.daily_work_summary?"":"muted"}>{session.daily_work_summary||t.legacySummary}</p></article></>}</PageState> }

function PhotoRecord({type,event,url,t,locale}:{type:string;event:Row;url?:string;t:T;locale:string}) { return <article className="admin-card photo-record">{url?<img className="attendance-photo" src={url} alt={type}/>:<div className="photo-placeholder"><div className="photo-person"><span/><i/></div></div>}<div className="photo-meta"><div><span>{type}</span><strong>{formatTime(event.server_timestamp,locale)}</strong></div><div><span>{t.recordId}</span><strong>{event.record_code||"—"}</strong></div><div><span>{t.serverTime}</span><strong>{formatDate(event.server_timestamp,locale)}</strong></div></div></article> }

function ReportsView({data,loading,error,load,t,locale,flash}:{data:Row;loading:boolean;error:string;load:()=>void;t:T;locale:string;flash:(s:string)=>void}) {
  const projects=data.demo?demoProjects:(data.projects||[]);
  const users=data.demo?demoPeople:(data.users||[]);
  const [previewProjectId,setPreviewProjectId]=useState("");
  const [previewWorkerId,setPreviewWorkerId]=useState("");
  const today=new Date().toISOString().slice(0,10);
  const [start,setStart]=useState(`${today.slice(0,8)}01`);
  const [end,setEnd]=useState(today);
  const [preview,setPreview]=useState<Row|null>(null);
  const [running,setRunning]=useState(false);
  const [downloading,setDownloading]=useState<"pdf"|"xlsx"|"csv"|null>(null);
  const [includePhotos,setIncludePhotos]=useState(false);
  const [reportError,setReportError]=useState("");
  const activeProjectId=projects.some((project:Row)=>project.id===previewProjectId)?previewProjectId:(projects[0]?.id||"");
  const activeWorkerId=users.some((user:Row)=>user.id===previewWorkerId)?previewWorkerId:"";
  const languageLocale=resolveIntlLocale(locale);

  function clearPreview(){setPreview(null);setReportError("");}

  async function runReport(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setRunning(true);setReportError("");
    const body={project_id:activeProjectId,worker_id:activeWorkerId||undefined,start:start||undefined,end:end||undefined};
    try{
      const response=await fetch("/api/admin/reports/preview",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      if(!response.ok)throw new Error("REPORT_FAILED");
      setPreview(await response.json());
    }catch{setPreview(null);setReportError(t.reportFailed)}finally{setRunning(false)}
  }

  async function download(type:"pdf"|"xlsx"|"csv"){
    if(!preview)return;
    setDownloading(type);setReportError("");
    const body={...preview.filters,include_photos:type==="pdf"&&includePhotos};
    const response=await fetch(`/api/admin/reports/${type}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    if(!response.ok){setReportError(t.reportFailed);setDownloading(null);return;}
    const blob=await response.blob();
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    const encodedFilename=response.headers.get("x-report-filename");
    let filename=`onsite-report.${type}`;
    if(encodedFilename){try{filename=decodeURIComponent(encodedFilename)}catch{/* Keep the safe fallback filename. */}}
    link.href=url;link.download=filename;link.click();URL.revokeObjectURL(url);flash(t.downloaded);
    setDownloading(null);
  }

  return <PageState loading={loading} error={error} empty={!projects.length} retry={load} t={t}><div className="report-workspace">
    <form className="admin-card report-builder" onSubmit={runReport}>
      <div className="report-builder-heading"><div className="report-icon"><FileText size={24}/></div><div><h2>{t.reportTitle}</h2><p>{t.reportHint}</p></div></div>
      <div className="report-filter-grid">
        <label>{t.project}<select name="project_id" value={activeProjectId} onChange={(event)=>{setPreviewProjectId(event.target.value);setPreviewWorkerId("");clearPreview()}}>{projects.map((p:Row)=><option key={p.id} value={p.id}>{p.project_name}</option>)}</select></label>
        <label>{t.worker}<select name="worker_id" value={activeWorkerId} onChange={(event)=>{setPreviewWorkerId(event.target.value);clearPreview()}}><option value="">{t.allPersonnel}</option>{users.map((user:Row)=><option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label>
        <label>{t.startDate}<input name="start" type="date" value={start} max={end||undefined} onChange={(event)=>{setStart(event.target.value);clearPreview()}}/></label>
        <label>{t.endDate}<input name="end" type="date" value={end} min={start||undefined} onChange={(event)=>{setEnd(event.target.value);clearPreview()}}/></label>
        <button className="admin-primary run-report-button" disabled={running} type="submit">{running?<LoaderCircle className="spin" size={17}/>:<FileBarChart size={17}/>} {running?t.runningReport:t.runReport}</button>
      </div>
      {reportError&&<p className="report-error" role="alert">{reportError}</p>}
    </form>

    {!preview?<article className="admin-card report-empty-preview"><FileBarChart size={30}/><h2>{t.reportPreview}</h2><p>{t.reportNotRun}</p></article>:<article className="report-preview">
      <div className="report-preview-toolbar"><div><span>{t.reportReady}</span><strong>{preview.project?.project_name}</strong></div><div className="report-export-actions"><label className="check-label"><input type="checkbox" checked={includePhotos} onChange={(event)=>setIncludePhotos(event.target.checked)}/><span>{includePhotos?"✓":""}</span>{t.include}</label><button className="admin-primary" type="button" disabled={downloading!==null} onClick={()=>download("pdf")}><FileText size={16}/>{downloading==="pdf"?t.loading:t.pdf}</button><button className="secondary-button" type="button" disabled={downloading!==null} onClick={()=>download("xlsx")}><ArrowDownToLine size={16}/>{downloading==="xlsx"?t.loading:t.excel}</button><button className="secondary-button" type="button" disabled={downloading!==null} onClick={()=>download("csv")}><ArrowDownToLine size={16}/>{downloading==="csv"?t.loading:t.csv}</button></div></div>
      <div className="report-paper">
        <header><div><strong>{preview.company_name||"—"}</strong><span>ONSITE SUPPORT PORTAL</span></div><p>SITE ATTENDANCE REPORT</p></header>
        <section className="report-project"><div><span>{t.customer}</span><strong>{preview.project?.customer_name||"—"}</strong></div><div><span>{t.project}</span><strong>{preview.project?.project_name||"—"}</strong></div><div><span>{t.site}</span><strong>{preview.project?.site_name||"—"}</strong></div><div><span>{t.period}</span><strong>{preview.filters?.start||"—"} — {preview.filters?.end||"—"}</strong></div><div className="wide"><span>{t.address}</span><strong>{preview.project?.address||"—"}</strong></div><div className="wide"><span>{t.coordinates}</span><strong>{formatProjectCoordinates(preview.project?.latitude,preview.project?.longitude)||"—"}</strong></div></section>
        {preview.project?.map_url&&<div className="report-map-frame"><img src={preview.project.map_url} alt={t.map}/>{formatProjectCoordinates(preview.project?.latitude,preview.project?.longitude)&&<div className="project-coordinate-overlay"><LocateFixed size={13}/><div><span>{t.coordinates}</span><strong>{formatProjectCoordinates(preview.project?.latitude,preview.project?.longitude)}</strong></div></div>}</div>}
        <section><h3>{t.total}</h3><div className="report-stat-grid"><div><span>{t.worker}</span><b>{preview.summary?.total_personnel||0}</b></div><div><span>{t.workSessions}</span><b>{preview.summary?.total_work_sessions||0}</b></div><div><span>{t.hours}</span><b>{preview.summary?.total_work_hours||0}</b></div><div><span>{t.workDays}</span><b>{preview.summary?.total_work_days||0}</b></div><div><span>{t.incomplete}</span><b>{preview.summary?.incomplete_sessions||0}</b></div></div></section>
        <section><h3>{t.personnelSummary}</h3>{preview.personnel?.length?<div className="report-table"><div className="report-table-row header"><span>{t.worker}</span><span>{t.company}</span><span>{t.workDays}</span><span>{t.hours}</span></div>{preview.personnel.map((person:Row)=><div className="report-table-row" key={`${person.name}-${person.company}`}><strong>{person.name}</strong><span>{person.company||"—"}</span><span>{person.days_on_site}</span><span>{person.hours}</span></div>)}</div>:<p className="report-no-rows">{t.noReportRows}</p>}</section>
        <section><h3>{t.dailyAttendance}</h3>{preview.sessions?.length?<div className="report-table attendance"><div className="report-table-row header"><span>{t.date}</span><span>{t.worker}</span><span>{t.checkIn}</span><span>{t.checkOut}</span><span>{t.hours}</span><span>{t.status}</span><span>{t.workSummary}</span></div>{preview.sessions.map((session:Row)=><div className="report-table-row" key={session.id}><strong>{session.date}</strong><span>{session.worker_name}</span><span>{formatTime(session.check_in,languageLocale)}</span><span>{formatTime(session.check_out,languageLocale)}</span><span>{session.hours??"—"}</span><span>{session.status}</span><span>{session.daily_work_summary||"—"}</span></div>)}</div>:<p className="report-no-rows">{t.noReportRows}</p>}</section>
      </div>
    </article>}
  </div></PageState>
}

function AuditView({data,loading,error,load,t,locale}:{data:Row;loading:boolean;error:string;load:()=>void;t:T;locale:string}) { const logs=data.logs||[];return <PageState loading={loading} error={error} empty={!logs.length} retry={load} t={t}><article className="admin-card audit-list">{logs.map((log:Row)=><div className="audit-item" key={log.id}><span className="audit-icon"><Activity size={17}/></span><div><strong>{log.action?.replaceAll("_"," ")}</strong><p>{one(log.admin)?.display_name||"Administrator"} · {log.entity_type}</p><blockquote><b>{t.reason}:</b> {log.reason}</blockquote></div><time>{formatDate(log.created_at,locale)} {formatTime(log.created_at,locale)}</time></div>)}</article></PageState> }

function AdminModal({modal,t,close,saved}:{modal:NonNullable<ModalState>;t:T;close:()=>void;saved:()=>void}) {
  const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");const form=new FormData(event.currentTarget);let url="";let method="POST";let body:Row={};
    if(modal.type==="worker"){url="/api/admin/users";body=Object.fromEntries(form.entries())}
    if(modal.type==="project"){url="/api/admin/projects";body=Object.fromEntries(form.entries());for(const key of ["address_line_2","site_name","state","postal_code","start_date","end_date","latitude","longitude"]){if(body[key]==="")body[key]=null}for(const key of ["latitude","longitude"]){if(body[key]!=null)body[key]=Number(body[key])}}
    if(modal.type==="edit-worker"){url=`/api/admin/users/${modal.record?.id}`;method="PATCH";body=Object.fromEntries(form.entries())}
    if(modal.type==="reset"){url=`/api/admin/users/${modal.record?.id}/reset-password`;body={password:form.get("password")}}
    if(modal.type==="correction"){url=`/api/admin/work-sessions/${modal.record?.id}`;method="PATCH";body=Object.fromEntries(form.entries());if(body.check_out_time==="")body.check_out_time=null}
    const response=await fetch(url,{method,headers:{"content-type":"application/json"},body:JSON.stringify(body)});if(!response.ok){const result=await response.json();setError(result.message||result.error||"Request failed");setBusy(false);return;}saved();
  }
  return <div className="modal-scrim"><section className="admin-modal"><header><div><strong>{modal.type==="worker"?t.addWorker:modal.type==="project"?t.addProject:modal.type==="reset"?t.reset:modal.type==="correction"?t.correct:t.edit}</strong><small>{modal.record?.display_name||modal.record?.project_name||""}</small></div><button onClick={close}><X size={19}/></button></header><form onSubmit={submit}><div className="modal-form">
    {modal.type==="worker"&&<><Field name="username" label={t.username}/><Field name="password" label={t.password} type="password"/><Field name="display_name" label={t.displayName}/><Field name="company" label={t.company}/><SelectField name="worker_type" label={t.workerType} value="EMPLOYEE" options={["EMPLOYEE","CONTRACTOR","SUBCONTRACTOR","PARTNER","TEMPORARY_WORKER"]}/><SelectField name="role" label={t.role} value="WORKER" options={["WORKER","ADMIN"]}/></>}
    {modal.type==="edit-worker"&&<><Field name="display_name" label={t.displayName} value={modal.record?.display_name}/><Field name="company" label={t.company} value={modal.record?.company}/><SelectField name="worker_type" label={t.workerType} value={modal.record?.worker_type} options={["EMPLOYEE","CONTRACTOR","SUBCONTRACTOR","PARTNER","TEMPORARY_WORKER"]}/><SelectField name="role" label={t.role} value={modal.record?.role} options={["WORKER","ADMIN"]}/><SelectField name="status" label={t.status} value={modal.record?.status} options={["ACTIVE","DISABLED"]}/></>}
    {modal.type==="reset"&&<Field name="password" label={t.password} type="password"/>}
    {modal.type==="project"&&<><Field name="project_code" label={t.projectCode}/><Field name="project_name" label={t.project}/><Field name="customer_name" label={t.customer}/><Field name="site_name" label={t.site}/><Field name="address_line_1" label={t.address}/><Field name="address_line_2" label={`${t.address} 2`}/><Field name="city" label="City"/><Field name="state" label="State"/><Field name="postal_code" label="ZIP"/><Field name="country" label="Country" value="United States"/><Field name="timezone" label={t.timezone} value="America/New_York"/><Field name="latitude" label={t.latitude} type="number" step="0.000001" min="-90" max="90"/><Field name="longitude" label={t.longitude} type="number" step="0.000001" min="-180" max="180"/><Field name="start_date" label={t.startDate} type="date"/><Field name="end_date" label={t.endDate} type="date"/></>}
    {modal.type==="correction"&&<><Field name="check_in_time" label={t.checkIn} value={modal.record?.check_in_time?.slice(0,16)} type="datetime-local"/><Field name="check_out_time" label={t.checkOut} value={modal.record?.check_out_time?.slice(0,16)} type="datetime-local"/><SelectField name="status" label={t.status} value="MANUALLY_CORRECTED" options={["COMPLETE","MISSING_CHECKOUT","LONG_SESSION","MANUALLY_CORRECTED","VOID"]}/><label className="wide"><span>{t.reason}</span><textarea name="reason" required minLength={5}/></label></>}
  </div>{error&&<p className="modal-error">{error}</p>}<footer><button type="button" className="secondary-button" onClick={close}>{t.cancel}</button><button className="admin-primary" disabled={busy}>{busy?t.loading:t.save}</button></footer></form></section></div> }

function SelectField({name,label,value,options}:{name:string;label:string;value?:string;options:string[]}) { return <label><span>{label}</span><select name={name} defaultValue={value}>{options.map((option)=><option key={option}>{option}</option>)}</select></label> }
