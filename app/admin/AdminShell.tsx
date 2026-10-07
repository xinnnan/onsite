"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element -- Joined rows vary; signed private images cannot use the Next image optimizer. */

import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowDownToLine, Bell, Building2, CalendarDays, CheckCircle2,
  ChevronDown, ChevronRight, ClipboardCheck, Clock3, FileBarChart, FileClock, FileText,
  KeyRound, LayoutDashboard, LoaderCircle, LocateFixed, MapPin, Menu, MoreHorizontal, Plus,
  Save, Search, SlidersHorizontal, Table2, Trash2, Undo2, Upload, Users, UserRoundCheck, Wand2, X,
  CalendarRange,
} from "lucide-react";
import { ClipboardEvent, DragEvent, FormEvent, Fragment, KeyboardEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import LanguageSelect from "@/app/components/LanguageSelect";
import { intlLocales, type Locale, useLanguage } from "@/app/lib/use-language";
import { formatProjectCoordinates } from "@/lib/project-coordinates";
import { DEMO_COMPANY_NAME } from "@/lib/demo";
import { TIME_ZONE_OPTIONS, formatLocalDate, formatLocalTime, getSessionTimeZone, toZonedDateTimeLocalInput } from "@/lib/timezones";
import { isWorkSummaryValid, WORK_SUMMARY_LIMITS } from "@/lib/work-summary";
import {
  addShiftRow, applyPastedTimes, buildSaveRequests, buildTimesheetRows, fillBlankRows, isRowDirty, isWeekend, mergeFailedDrafts,
  normalizeTimeInput, removeShiftRow, rowDurationSeconds, rowTimeZone, validateTimesheetRows,
  type TimesheetIssue, type TimesheetRow, type TimesheetSessionInput,
} from "@/lib/timesheet";

export type AdminView = "dashboard" | "users" | "projects" | "project-detail" | "assignments" | "attendance" | "attendance-detail" | "attendance-timesheet" | "reports" | "audit";
type Row = Record<string, any>;
type ModalState = { type: "worker" | "project" | "edit-worker" | "reset" | "correction" | "manual-attendance" | "delete-attendance"; record?: Row } | null;

const text = {
  zh: { admin:"管理中心",dashboard:"概览",users:"人员管理",projects:"项目管理",assignments:"项目分配",attendance:"考勤记录",reports:"报告中心",audit:"审计日志",search:"搜索人员、项目或记录…",language:"English",today:"今天",addWorker:"新建人员",addProject:"新建项目",filter:"筛选",export:"导出",active:"进行中",complete:"已完成",missing:"缺少签退",currently:"当前在场",inToday:"今日签到",outToday:"今日签退",sessions:"完整工时段",exceptions:"异常记录",live:"实时",onSite:"当前现场人员",recent:"最近考勤记录",worker:"人员",project:"项目",checkIn:"签到",checkOut:"签退",hours:"工时",status:"状态",customer:"客户",site:"现场",address:"地址",map:"地图",action:"操作",company:"公司",assigned:"分配项目",edit:"编辑",reset:"重置密码",save:"保存",cancel:"取消",loading:"正在加载…",empty:"暂无记录",loadError:"加载失败，请重试",retry:"重试",projectCode:"项目编号",reportTitle:"生成客户项目报告",period:"报告期间",include:"PDF 包含考勤照片",pdf:"生成 PDF",excel:"导出 Excel",csv:"下载 CSV",auditTitle:"管理员操作记录",reason:"修改原因",details:"查看详情",projectInfo:"项目信息",mapUpload:"项目地图截图",replace:"上传 / 替换",uploadingMap:"正在上传…",uploadMapError:"地图上传失败，请检查图片格式后重试",attendanceTitle:"考勤记录",date:"日期",view:"查看",assignedWorkers:"已分配人员",availableWorkers:"可分配人员",photos:"现场照片",total:"合计",serverTime:"服务器时间",recordId:"记录编号",snapshot:"项目快照",menu:"菜单",logout:"退出",changePassword:"修改密码",create:"创建",password:"临时密码",displayName:"显示名称",username:"用户名",workerType:"人员类型",role:"角色",timezone:"时区",startDate:"开始日期",endDate:"结束日期",correct:"修正记录",downloaded:"文件已下载",saved:"已保存",resetDone:"密码已重置",allPersonnel:"所有人员",runReport:"运行报告",runningReport:"正在生成预览…",reportPreview:"报告预览",reportHint:"选择项目、人员范围和报告期间，然后运行报告查看结果。",reportNotRun:"设置筛选条件后，点击“运行报告”生成预览。",reportFailed:"报告生成失败，请重试",exportOptions:"导出选项",personnelSummary:"人员汇总",dailyAttendance:"每日考勤",workSessions:"工时段",workDays:"工作日",incomplete:"未完成",noReportRows:"当前筛选条件下暂无考勤记录",reportReady:"预览已生成",latitude:"纬度",longitude:"经度",coordinates:"项目参考坐标",workSummary:"今日工作总结",legacySummary:"此历史记录未填写工作总结",deleted:"已删除" },
  en: { admin:"Admin center",dashboard:"Overview",users:"Workers",projects:"Projects",assignments:"Assignments",attendance:"Attendance",reports:"Reports",audit:"Audit log",search:"Search people, projects or records…",language:"Español",today:"Today",addWorker:"Add worker",addProject:"Add project",filter:"Filter",export:"Export",active:"Active",complete:"Complete",missing:"Missing checkout",currently:"Currently on site",inToday:"Checked in today",outToday:"Checked out today",sessions:"Complete sessions",exceptions:"Exceptions",live:"Live",onSite:"Currently on site",recent:"Recent attendance",worker:"Worker",project:"Project",checkIn:"Check in",checkOut:"Check out",hours:"Hours",status:"Status",customer:"Customer",site:"Site",address:"Address",map:"Map",action:"Action",company:"Company",assigned:"Assigned projects",edit:"Edit",reset:"Reset password",save:"Save",cancel:"Cancel",loading:"Loading…",empty:"No records yet",loadError:"Could not load data. Try again.",retry:"Retry",projectCode:"Project code",reportTitle:"Create customer project report",period:"Reporting period",include:"Include attendance photos in PDF",pdf:"Create PDF",excel:"Export Excel",csv:"Download CSV",auditTitle:"Administrator activity",reason:"Reason",details:"View details",projectInfo:"Project information",mapUpload:"Project map screenshot",replace:"Upload / replace",uploadingMap:"Uploading…",uploadMapError:"Map upload failed. Check the image format and try again.",attendanceTitle:"Attendance records",date:"Date",view:"View",assignedWorkers:"Assigned workers",availableWorkers:"Available workers",photos:"Field photos",total:"Total",serverTime:"Server time",recordId:"Record ID",snapshot:"Project snapshot",menu:"Menu",logout:"Log out",changePassword:"Change password",create:"Create",password:"Temporary password",displayName:"Display name",username:"Username",workerType:"Worker type",role:"Role",timezone:"Timezone",startDate:"Start date",endDate:"End date",correct:"Correct record",downloaded:"File downloaded",saved:"Saved",resetDone:"Password reset",allPersonnel:"All personnel",runReport:"Run report",runningReport:"Generating preview…",reportPreview:"Report preview",reportHint:"Select a project, personnel scope, and reporting period, then run the report to review the results.",reportNotRun:"Set the filters, then select Run report to generate a preview.",reportFailed:"Could not generate the report. Try again.",exportOptions:"Export options",personnelSummary:"Personnel summary",dailyAttendance:"Daily attendance",workSessions:"Work sessions",workDays:"Work days",incomplete:"Incomplete",noReportRows:"No attendance records match these filters",reportReady:"Preview ready",latitude:"Latitude",longitude:"Longitude",coordinates:"Project reference coordinates",workSummary:"Today's work summary",legacySummary:"No work summary was recorded for this historical session",deleted:"Deleted" },
  es: { admin:"Centro de administración",dashboard:"Resumen",users:"Personal",projects:"Proyectos",assignments:"Asignaciones",attendance:"Asistencia",reports:"Informes",audit:"Registro de auditoría",search:"Buscar personas, proyectos o registros…",language:"한국어",today:"Hoy",addWorker:"Añadir usuario",addProject:"Añadir proyecto",filter:"Filtrar",export:"Exportar",active:"Activo",complete:"Completo",missing:"Falta la salida",currently:"Actualmente en el sitio",inToday:"Entradas de hoy",outToday:"Salidas de hoy",sessions:"Jornadas completas",exceptions:"Excepciones",live:"En vivo",onSite:"Personal actualmente en el sitio",recent:"Asistencia reciente",worker:"Personal",project:"Proyecto",checkIn:"Entrada",checkOut:"Salida",hours:"Horas",status:"Estado",customer:"Cliente",site:"Sitio",address:"Dirección",map:"Mapa",action:"Acción",company:"Empresa",assigned:"Proyectos asignados",edit:"Editar",reset:"Restablecer contraseña",save:"Guardar",cancel:"Cancelar",loading:"Cargando…",empty:"Aún no hay registros",loadError:"No se pudieron cargar los datos. Inténtalo de nuevo.",retry:"Reintentar",projectCode:"Código del proyecto",reportTitle:"Crear informe del proyecto",period:"Período del informe",include:"Incluir fotos de asistencia en el PDF",pdf:"Crear PDF",excel:"Exportar Excel",csv:"Descargar CSV",auditTitle:"Actividad del administrador",reason:"Motivo",details:"Ver detalles",projectInfo:"Información del proyecto",mapUpload:"Imagen del mapa del proyecto",replace:"Subir / reemplazar",uploadingMap:"Subiendo…",uploadMapError:"No se pudo subir el mapa. Revisa el formato de la imagen.",attendanceTitle:"Registros de asistencia",date:"Fecha",view:"Ver",assignedWorkers:"Personal asignado",availableWorkers:"Personal disponible",photos:"Fotos del sitio",total:"Total",serverTime:"Hora del servidor",recordId:"ID del registro",snapshot:"Datos del proyecto",menu:"Menú",logout:"Cerrar sesión",changePassword:"Cambiar contraseña",create:"Crear",password:"Contraseña temporal",displayName:"Nombre visible",username:"Usuario",workerType:"Tipo de personal",role:"Rol",timezone:"Zona horaria",startDate:"Fecha inicial",endDate:"Fecha final",correct:"Corregir registro",downloaded:"Archivo descargado",saved:"Guardado",resetDone:"Contraseña restablecida",allPersonnel:"Todo el personal",runReport:"Ejecutar informe",runningReport:"Generando vista previa…",reportPreview:"Vista previa del informe",reportHint:"Selecciona un proyecto, el personal y el período; luego ejecuta el informe para revisar los resultados.",reportNotRun:"Configura los filtros y selecciona Ejecutar informe para generar una vista previa.",reportFailed:"No se pudo generar el informe. Inténtalo de nuevo.",exportOptions:"Opciones de exportación",personnelSummary:"Resumen del personal",dailyAttendance:"Asistencia diaria",workSessions:"Sesiones de trabajo",workDays:"Días trabajados",incomplete:"Incompletas",noReportRows:"No hay registros que coincidan con estos filtros",reportReady:"Vista previa lista",latitude:"Latitud",longitude:"Longitud",coordinates:"Coordenadas de referencia del proyecto",workSummary:"Resumen del trabajo de hoy",legacySummary:"Esta sesión histórica no tiene un resumen de trabajo",deleted:"Eliminado" },
  ko: { admin:"관리 센터",dashboard:"개요",users:"인력 관리",projects:"프로젝트",assignments:"프로젝트 배정",attendance:"근태 기록",reports:"보고서",audit:"감사 로그",search:"인력, 프로젝트 또는 기록 검색…",language:"中文",today:"오늘",addWorker:"사용자 추가",addProject:"프로젝트 추가",filter:"필터",export:"내보내기",active:"진행 중",complete:"완료",missing:"퇴근 누락",currently:"현재 현장 근무 중",inToday:"오늘 출근",outToday:"오늘 퇴근",sessions:"완료된 근무 세션",exceptions:"예외",live:"실시간",onSite:"현재 현장 인력",recent:"최근 근태 기록",worker:"인력",project:"프로젝트",checkIn:"출근",checkOut:"퇴근",hours:"시간",status:"상태",customer:"고객",site:"현장",address:"주소",map:"지도",action:"작업",company:"회사",assigned:"배정된 프로젝트",edit:"수정",reset:"비밀번호 재설정",save:"저장",cancel:"취소",loading:"불러오는 중…",empty:"아직 기록이 없습니다",loadError:"데이터를 불러오지 못했습니다. 다시 시도하세요.",retry:"다시 시도",projectCode:"프로젝트 코드",reportTitle:"고객 프로젝트 보고서 생성",period:"보고 기간",include:"PDF에 근태 사진 포함",pdf:"PDF 생성",excel:"Excel 내보내기",csv:"CSV 다운로드",auditTitle:"관리자 활동",reason:"사유",details:"상세 보기",projectInfo:"프로젝트 정보",mapUpload:"프로젝트 지도 이미지",replace:"업로드 / 교체",uploadingMap:"업로드 중…",uploadMapError:"지도를 업로드하지 못했습니다. 이미지 형식을 확인하세요.",attendanceTitle:"근태 기록",date:"날짜",view:"보기",assignedWorkers:"배정된 인력",availableWorkers:"배정 가능한 인력",photos:"현장 사진",total:"합계",serverTime:"서버 시간",recordId:"기록 ID",snapshot:"프로젝트 스냅샷",menu:"메뉴",logout:"로그아웃",changePassword:"비밀번호 변경",create:"생성",password:"임시 비밀번호",displayName:"표시 이름",username:"사용자 이름",workerType:"인력 유형",role:"역할",timezone:"시간대",startDate:"시작일",endDate:"종료일",correct:"기록 수정",downloaded:"파일 다운로드 완료",saved:"저장됨",resetDone:"비밀번호가 재설정됨",allPersonnel:"전체 인력",runReport:"보고서 실행",runningReport:"미리보기 생성 중…",reportPreview:"보고서 미리보기",reportHint:"프로젝트, 인력 범위 및 보고 기간을 선택한 후 보고서를 실행해 결과를 확인하세요.",reportNotRun:"필터를 설정한 후 보고서 실행을 선택해 미리보기를 생성하세요.",reportFailed:"보고서를 생성하지 못했습니다. 다시 시도하세요.",exportOptions:"내보내기 옵션",personnelSummary:"인력 요약",dailyAttendance:"일일 근태",workSessions:"근무 세션",workDays:"근무일",incomplete:"미완료",noReportRows:"필터와 일치하는 근태 기록이 없습니다",reportReady:"미리보기 준비 완료",latitude:"위도",longitude:"경도",coordinates:"프로젝트 기준 좌표",workSummary:"오늘의 작업 요약",legacySummary:"이 이전 근무 기록에는 작업 요약이 없습니다",deleted:"삭제됨" },
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

const dashboardText = {
  zh: { todayAttendance:"今日考勤记录", attendanceRecords:"考勤记录", chooseDate:"选择考勤日期", noPeople:"暂无人员", noAttendance:"当天暂无考勤记录", morePeople:(count:number)=>`另有 ${count} 人` },
  en: { todayAttendance:"Today's attendance", attendanceRecords:"Attendance records", chooseDate:"Select attendance date", noPeople:"No personnel", noAttendance:"No attendance records for this date", morePeople:(count:number)=>`${count} more` },
  es: { todayAttendance:"Asistencia de hoy", attendanceRecords:"Registros de asistencia", chooseDate:"Seleccionar fecha de asistencia", noPeople:"Sin personal", noAttendance:"No hay registros de asistencia para esta fecha", morePeople:(count:number)=>`${count} más` },
  ko: { todayAttendance:"오늘의 근태 기록", attendanceRecords:"근태 기록", chooseDate:"근태 날짜 선택", noPeople:"해당 인력 없음", noAttendance:"선택한 날짜에 근태 기록이 없습니다", morePeople:(count:number)=>`${count}명 더 있음` },
} as const;

const timeText = {
  zh: { localTime:"项目当地时间",localDate:"项目当地日期",projectTimeZone:"项目时区",projectCorrectionHint:"如果员工选错项目，可在此改为正确项目；项目快照、报告和照片水印会同步更新。",correctionHint:(timeZone:string)=>`以下签到、签退时间均按项目当地时区 ${timeZone} 输入；保存时会转换为服务器 UTC 时间。` },
  en: { localTime:"Project local time",localDate:"Project local date",projectTimeZone:"Project time zone",projectCorrectionHint:"If the worker selected the wrong project, choose the correct one here. Project snapshots, reports, and photo watermarks will update together.",correctionHint:(timeZone:string)=>`Enter check-in and check-out in the project's local time zone (${timeZone}). They will be stored as server UTC.` },
  es: { localTime:"Hora local del proyecto",localDate:"Fecha local del proyecto",projectTimeZone:"Zona horaria del proyecto",projectCorrectionHint:"Si el empleado eligió el proyecto incorrecto, selecciona aquí el correcto. Los datos, informes y marcas de agua se actualizarán juntos.",correctionHint:(timeZone:string)=>`Introduce la entrada y salida en la hora local del proyecto (${timeZone}). Se guardarán como UTC del servidor.` },
  ko: { localTime:"프로젝트 현지 시간",localDate:"프로젝트 현지 날짜",projectTimeZone:"프로젝트 시간대",projectCorrectionHint:"직원이 잘못된 프로젝트를 선택한 경우 여기에서 올바른 프로젝트로 변경하세요. 프로젝트 스냅샷, 보고서 및 사진 워터마크가 함께 업데이트됩니다.",correctionHint:(timeZone:string)=>`출퇴근 시간은 프로젝트 현지 시간대(${timeZone})로 입력하세요. 저장 시 서버 UTC로 변환됩니다.` },
} as const;

const manualAttendanceText = {
  zh: { add:"补录考勤",title:"管理员补录考勤",helper:"用于人员漏打卡的情况。照片可以上传但不是必填，所有时间按所选项目的当地时区填写。",worker:"选择人员",project:"选择项目",checkIn:"签到时间",checkOut:"签退时间（可留空）",checkInPhoto:"签到照片（可选）",checkOutPhoto:"签退照片（可选）",photoHint:"支持 JPG、PNG、WEBP，单张最大 15 MB。",photoError:"照片格式或文件大小不符合要求，请选择 JPG、PNG 或 WEBP 图片。",checkoutPhotoTime:"上传签退照片前请先填写签退时间。",editPhotoHint:"选择新照片将替换现有照片；不选择则保留原照片。",hasPhoto:"当前已有照片",noPhotoYet:"当前没有照片",note:"补录备注（可选）",notePlaceholder:"例如：人员现场工作但漏打卡，由管理员根据现场记录补录。",noPhoto:"签到、签退照片均为可选",create:"创建考勤记录",created:"考勤记录已补录",overlap:"该人员已有进行中的记录，或所选时间段与现有考勤重叠。",timezone:(zone:string)=>`项目当地时区：${zone}；数据库仍保存服务器 UTC 时间。`,manual:"管理员补录",adminNote:"管理员备注" },
  en: { add:"Add attendance",title:"Add attendance manually",helper:"Use this when someone missed a punch. Photos can be added but are optional, and times use the selected project's local time zone.",worker:"Select worker",project:"Select project",checkIn:"Check-in time",checkOut:"Check-out time (optional)",checkInPhoto:"Check-in photo (optional)",checkOutPhoto:"Check-out photo (optional)",photoHint:"JPG, PNG, or WEBP; maximum 15 MB per photo.",photoError:"The photo type or size is not supported. Choose a JPG, PNG, or WEBP image.",checkoutPhotoTime:"Enter a check-out time before adding a check-out photo.",editPhotoHint:"Selecting a new photo replaces the current one; leave it empty to keep the current photo.",hasPhoto:"Current photo available",noPhotoYet:"No current photo",note:"Admin note (optional)",notePlaceholder:"Example: Worker was on site but missed the punch; added from the site record.",noPhoto:"Check-in and check-out photos are optional",create:"Create attendance record",created:"Attendance record created",overlap:"This worker has an open session or the selected time overlaps an existing attendance record.",timezone:(zone:string)=>`Project local time zone: ${zone}. The database will still store server UTC.`,manual:"Admin entry",adminNote:"Admin note" },
  es: { add:"Añadir asistencia",title:"Añadir asistencia manualmente",helper:"Úsalo cuando alguien olvidó registrar una entrada o salida. Las fotos se pueden añadir, pero son opcionales; las horas corresponden a la zona horaria local del proyecto.",worker:"Seleccionar personal",project:"Seleccionar proyecto",checkIn:"Hora de entrada",checkOut:"Hora de salida (opcional)",checkInPhoto:"Foto de entrada (opcional)",checkOutPhoto:"Foto de salida (opcional)",photoHint:"JPG, PNG o WEBP; máximo 15 MB por foto.",photoError:"El tipo o tamaño de la foto no es compatible. Selecciona una imagen JPG, PNG o WEBP.",checkoutPhotoTime:"Introduce una hora de salida antes de añadir la foto de salida.",editPhotoHint:"Al seleccionar una foto nueva se reemplaza la actual; déjalo vacío para conservarla.",hasPhoto:"Hay una foto actual",noPhotoYet:"No hay foto actual",note:"Nota del administrador (opcional)",notePlaceholder:"Ejemplo: La persona estuvo en el sitio pero olvidó registrar la asistencia.",noPhoto:"Las fotos de entrada y salida son opcionales",create:"Crear registro",created:"Registro de asistencia creado",overlap:"La persona tiene una sesión abierta o el período se superpone con otro registro.",timezone:(zone:string)=>`Zona horaria local del proyecto: ${zone}. La base de datos conservará UTC.`,manual:"Entrada administrativa",adminNote:"Nota del administrador" },
  ko: { add:"근태 기록 추가",title:"관리자 근태 기록 추가",helper:"출퇴근 기록을 누락한 경우 사용합니다. 사진을 추가할 수 있지만 필수는 아니며 시간은 선택한 프로젝트의 현지 시간대를 사용합니다.",worker:"인력 선택",project:"프로젝트 선택",checkIn:"출근 시간",checkOut:"퇴근 시간(선택)",checkInPhoto:"출근 사진(선택)",checkOutPhoto:"퇴근 사진(선택)",photoHint:"JPG, PNG, WEBP 지원, 사진당 최대 15MB.",photoError:"지원하지 않는 사진 형식 또는 크기입니다. JPG, PNG 또는 WEBP 이미지를 선택하세요.",checkoutPhotoTime:"퇴근 사진을 추가하기 전에 퇴근 시간을 입력하세요.",editPhotoHint:"새 사진을 선택하면 기존 사진이 교체됩니다. 선택하지 않으면 기존 사진이 유지됩니다.",hasPhoto:"현재 사진 있음",noPhotoYet:"현재 사진 없음",note:"관리자 메모(선택)",notePlaceholder:"예: 현장 근무는 확인되었으나 출퇴근 기록을 누락하여 관리자가 추가함.",noPhoto:"출근 및 퇴근 사진은 선택 사항입니다",create:"근태 기록 생성",created:"근태 기록이 생성되었습니다",overlap:"해당 인력의 진행 중인 기록이 있거나 선택한 시간이 기존 근태 기록과 겹칩니다.",timezone:(zone:string)=>`프로젝트 현지 시간대: ${zone}. 데이터베이스에는 서버 UTC로 저장됩니다.`,manual:"관리자 입력",adminNote:"관리자 메모" },
} as const;

const deleteAttendanceText = {
  zh: { action:"删除记录",title:"永久删除考勤记录",warning:"该考勤记录及关联照片将被永久删除，无法恢复。管理员操作日志只保留删除动作和原因，不保留考勤内容。",reason:"删除原因",placeholder:"请说明删除原因，例如重复补录或人员选择错误。",confirm:"永久删除",success:"考勤记录已永久删除",reasonError:"请填写至少 5 个字符的删除原因。" },
  en: { action:"Delete record",title:"Permanently delete attendance record",warning:"This attendance record and its photos will be permanently deleted and cannot be recovered. The admin audit log keeps only the deletion action and reason, not the attendance contents.",reason:"Reason for deletion",placeholder:"Explain why this record should be deleted, such as a duplicate entry or wrong worker.",confirm:"Permanently delete",success:"Attendance record permanently deleted",reasonError:"Enter a deletion reason of at least 5 characters." },
  es: { action:"Eliminar registro",title:"Eliminar permanentemente el registro",warning:"Este registro de asistencia y sus fotos se eliminarán permanentemente y no se podrán recuperar. El registro de auditoría solo conserva la acción y el motivo, no el contenido del registro.",reason:"Motivo de eliminación",placeholder:"Indica el motivo, por ejemplo, registro duplicado o personal incorrecto.",confirm:"Eliminar permanentemente",success:"Registro eliminado permanentemente",reasonError:"Introduce un motivo de al menos 5 caracteres." },
  ko: { action:"기록 삭제",title:"근태 기록 영구 삭제",warning:"이 근태 기록과 관련 사진은 복구할 수 없도록 영구 삭제됩니다. 관리자 감사 로그에는 근태 내용이 아닌 삭제 작업과 사유만 남습니다.",reason:"삭제 사유",placeholder:"중복 입력 또는 잘못 선택한 인력 등 삭제 사유를 입력하세요.",confirm:"영구 삭제",success:"근태 기록이 영구 삭제되었습니다",reasonError:"삭제 사유를 5자 이상 입력하세요." },
} as const;

const photoUploadText = {
  zh: { drop:"将图片拖到这里，或点击选择",selected:"已选择",clear:"清除所选图片" },
  en: { drop:"Drag an image here, or click to choose",selected:"Selected",clear:"Clear selected image" },
  es: { drop:"Arrastra una imagen aquí o haz clic para elegir",selected:"Seleccionada",clear:"Quitar imagen seleccionada" },
  ko: { drop:"이미지를 여기에 끌어 놓거나 클릭하여 선택",selected:"선택됨",clear:"선택한 이미지 지우기" },
} as const;

const adminWorkSummaryText = {
  zh: { label:"今日工作总结（可选）",placeholder:"例如：今天完成 6 台机器人的例行检查，更换 2 个传感器，并测试运行状态正常。",rule:"如填写，需满足任一项：20 个汉字、10 个英文单词或 40 个有效字符。",error:"今日工作总结需达到 20 个汉字、10 个英文单词或 40 个有效字符中的任一项。" },
  en: { label:"Today's work summary (optional)",placeholder:"Example: Completed inspections on six robots, replaced two sensors, and verified normal operation.",rule:"If entered, meet one: 20 Chinese characters, 10 English words, or 40 effective characters.",error:"The work summary must contain 20 Chinese characters, 10 English words, or 40 effective characters." },
  es: { label:"Resumen del trabajo de hoy (opcional)",placeholder:"Ejemplo: Inspeccioné seis robots, reemplacé dos sensores y verifiqué su funcionamiento normal.",rule:"Si se completa, cumple una opción: 20 caracteres chinos, 10 palabras o 40 caracteres efectivos.",error:"El resumen debe contener 20 caracteres chinos, 10 palabras o 40 caracteres efectivos." },
  ko: { label:"오늘의 작업 요약(선택)",placeholder:"예: 로봇 6대를 점검하고 센서 2개를 교체한 후 정상 작동을 확인했습니다.",rule:"입력하는 경우 한자 20자, 영문 10단어 또는 유효 문자 40자 중 하나를 충족해야 합니다.",error:"작업 요약은 한자 20자, 영문 10단어 또는 유효 문자 40자 중 하나를 충족해야 합니다." },
} as const;

const assignmentText = {
  zh: { bulkTitle:"批量项目分配", bulkDescription:"选择多个人员和多个项目，一次完成所有组合的分配。", selectProjects:"选择项目", selectPeople:"选择人员", searchProjects:"搜索项目名称或编号…", searchPeople:"搜索姓名、用户名或公司…", selectResults:"全选当前结果", clear:"清空", selected:"已选", noResults:"没有匹配结果", assign:"批量添加", remove:"批量移除", saving:"批量处理中…", added:"批量分配已完成", removed:"批量移除已完成", failed:"批量操作失败，请重试", quickTitle:"单项目快速调整", summary:(people:number,projects:number)=>`${people} 名人员 × ${projects} 个项目，共 ${people*projects} 条分配` },
  en: { bulkTitle:"Bulk project assignments", bulkDescription:"Select multiple people and projects to update every combination at once.", selectProjects:"Select projects", selectPeople:"Select personnel", searchProjects:"Search project name or code…", searchPeople:"Search name, username, or company…", selectResults:"Select current results", clear:"Clear", selected:"Selected", noResults:"No matching results", assign:"Add assignments", remove:"Remove assignments", saving:"Updating…", added:"Bulk assignments completed", removed:"Bulk removal completed", failed:"Bulk update failed. Try again.", quickTitle:"Quick single-project adjustment", summary:(people:number,projects:number)=>`${people} people × ${projects} projects · ${people*projects} assignments` },
  es: { bulkTitle:"Asignación masiva de proyectos", bulkDescription:"Selecciona varias personas y proyectos para actualizar todas las combinaciones a la vez.", selectProjects:"Seleccionar proyectos", selectPeople:"Seleccionar personal", searchProjects:"Buscar proyecto o código…", searchPeople:"Buscar nombre, usuario o empresa…", selectResults:"Seleccionar resultados", clear:"Limpiar", selected:"Seleccionados", noResults:"No hay resultados", assign:"Añadir asignaciones", remove:"Quitar asignaciones", saving:"Actualizando…", added:"Asignaciones masivas completadas", removed:"Eliminación masiva completada", failed:"No se pudo completar la operación.", quickTitle:"Ajuste rápido de un proyecto", summary:(people:number,projects:number)=>`${people} personas × ${projects} proyectos · ${people*projects} asignaciones` },
  ko: { bulkTitle:"프로젝트 일괄 배정", bulkDescription:"여러 인력과 프로젝트를 선택하여 모든 조합을 한 번에 업데이트합니다.", selectProjects:"프로젝트 선택", selectPeople:"인력 선택", searchProjects:"프로젝트명 또는 코드 검색…", searchPeople:"이름, 사용자명 또는 회사 검색…", selectResults:"현재 결과 전체 선택", clear:"지우기", selected:"선택됨", noResults:"일치하는 결과가 없습니다", assign:"일괄 추가", remove:"일괄 제거", saving:"처리 중…", added:"일괄 배정이 완료되었습니다", removed:"일괄 제거가 완료되었습니다", failed:"일괄 작업에 실패했습니다. 다시 시도하세요.", quickTitle:"단일 프로젝트 빠른 조정", summary:(people:number,projects:number)=>`${people}명 × 프로젝트 ${projects}개 · 배정 ${people*projects}건` },
} as const;

const reportScopeText = {
  zh: { allProjects:"全部项目", projectsCovered:"涉及项目", projectCount:(count:number)=>`全部项目（${count}）`, customers:"客户" },
  en: { allProjects:"All projects", projectsCovered:"Projects covered", projectCount:(count:number)=>`All projects (${count})`, customers:"Customers" },
  es: { allProjects:"Todos los proyectos", projectsCovered:"Proyectos incluidos", projectCount:(count:number)=>`Todos los proyectos (${count})`, customers:"Clientes" },
  ko: { allProjects:"전체 프로젝트", projectsCovered:"포함된 프로젝트", projectCount:(count:number)=>`전체 프로젝트 (${count})`, customers:"고객사" },
} as const;

const timesheetText = {
  zh: { records:"考勤记录", timesheet:"工时表", title:"个人工时表", hint:"选择人员和任意日期范围，列出每一天。像 Excel 一样输入签到/签退（8、830、17:30、5:30pm），或直接从 Excel 粘贴。时间按各项目当地时区填写。", load:"加载工时表", choose:"选择人员和日期范围后加载工时表。", defaultProject:"新记录默认项目", defaultIn:"默认签到", defaultOut:"默认签退", fillBlank:"填充空白日期", weekdaysOnly:"仅工作日", projectSite:"项目 / 现场", in:"签到", out:"签退", entry:"记录类型", nextDay:"次日", addShift:"当天再添加一个班次", removeShift:"移除此未保存行", openRecord:"打开记录", newEntry:"新补录", edited:"已修改", workerPunch:"人员打卡", locked:"跨越超过一天，请在记录详情页修改", unsaved:(count:number)=>`${count} 处未保存修改`, reason:"修改原因（写入审计日志）", defaultReason:"管理员通过工时表人工核实", save:"保存修改", saving:(done:number,total:number)=>`正在保存 ${done} / ${total}…`, discard:"放弃修改", saved:(count:number)=>`已保存 ${count} 行`, partial:(saved:number,failed:number)=>`已保存 ${saved} 行，${failed} 行需要处理`, confirmDiscard:"工时表有未保存的修改，确定放弃吗？", total:"合计", daysWorked:"出勤天数", fixFirst:(count:number)=>`保存前请先修正 ${count} 行`, saveFailed:"该行保存失败", issues:{ BOTH_TIMES_REQUIRED:"请填写签到和签退", CHECK_IN_REQUIRED:"签到时间不能为空", DELETE_ON_RECORD_PAGE:"如需删除，请打开记录详情", INVALID_TIME:"请输入如 8:00 或 5:30pm 的时间", SAME_TIME:"签到和签退不能相同", PROJECT_REQUIRED:"请选择进行中的项目", OVERLAP:"与该日期的记录时间重叠：" } },
  en: { records:"Records", timesheet:"Timesheet", title:"Personal timesheet", hint:"Pick a person and any date range to list every day. Type In/Out like a spreadsheet (8, 830, 17:30, 5:30pm) or paste straight from Excel. Times use each project's local time zone.", load:"Load timesheet", choose:"Choose a person and date range, then load the timesheet.", defaultProject:"Default project for new entries", defaultIn:"Default in", defaultOut:"Default out", fillBlank:"Fill blank days", weekdaysOnly:"Weekdays only", projectSite:"Project / Site", in:"In", out:"Out", entry:"Entry", nextDay:"Next day", addShift:"Add another shift on this day", removeShift:"Remove this unsaved row", openRecord:"Open record", newEntry:"New entry", edited:"Edited", workerPunch:"Worker check-in", locked:"Spans more than a day — edit it on the record page", unsaved:(count:number)=>`${count} unsaved ${count===1?"change":"changes"}`, reason:"Reason (saved to the audit log)", defaultReason:"Verified manually via timesheet", save:"Save changes", saving:(done:number,total:number)=>`Saving ${done} / ${total}…`, discard:"Discard changes", saved:(count:number)=>`${count} ${count===1?"row":"rows"} saved`, partial:(saved:number,failed:number)=>`${saved} saved, ${failed} need attention`, confirmDiscard:"You have unsaved timesheet changes. Discard them?", total:"Total", daysWorked:"Days worked", fixFirst:(count:number)=>`Fix ${count} ${count===1?"row":"rows"} before saving`, saveFailed:"This row could not be saved", issues:{ BOTH_TIMES_REQUIRED:"Enter both In and Out", CHECK_IN_REQUIRED:"In time is required", DELETE_ON_RECORD_PAGE:"To delete, open the record", INVALID_TIME:"Use a time like 8:00 or 5:30pm", SAME_TIME:"In and Out cannot match", PROJECT_REQUIRED:"Choose an active project", OVERLAP:"Overlaps the record on " } },
  es: { records:"Registros", timesheet:"Hoja de horas", title:"Hoja de horas personal", hint:"Elige una persona y cualquier rango de fechas para ver todos los días. Escribe entrada/salida como en una hoja de cálculo (8, 830, 17:30, 5:30pm) o pega desde Excel. Las horas usan la zona horaria local de cada proyecto.", load:"Cargar hoja", choose:"Elige una persona y un rango de fechas y carga la hoja de horas.", defaultProject:"Proyecto predeterminado", defaultIn:"Entrada predeterminada", defaultOut:"Salida predeterminada", fillBlank:"Rellenar días vacíos", weekdaysOnly:"Solo días laborables", projectSite:"Proyecto / Sitio", in:"Entrada", out:"Salida", entry:"Tipo", nextDay:"Día siguiente", addShift:"Añadir otro turno este día", removeShift:"Quitar esta fila sin guardar", openRecord:"Abrir registro", newEntry:"Nuevo registro", edited:"Editado", workerPunch:"Marcaje del personal", locked:"Dura más de un día: edítalo en la página del registro", unsaved:(count:number)=>`${count} ${count===1?"cambio":"cambios"} sin guardar`, reason:"Motivo (se guarda en auditoría)", defaultReason:"Verificado manualmente en la hoja de horas", save:"Guardar cambios", saving:(done:number,total:number)=>`Guardando ${done} / ${total}…`, discard:"Descartar cambios", saved:(count:number)=>`${count} ${count===1?"fila guardada":"filas guardadas"}`, partial:(saved:number,failed:number)=>`${saved} guardadas, ${failed} requieren atención`, confirmDiscard:"Hay cambios sin guardar en la hoja de horas. ¿Descartarlos?", total:"Total", daysWorked:"Días trabajados", fixFirst:(count:number)=>`Corrige ${count} ${count===1?"fila":"filas"} antes de guardar`, saveFailed:"No se pudo guardar esta fila", issues:{ BOTH_TIMES_REQUIRED:"Indica entrada y salida", CHECK_IN_REQUIRED:"La entrada es obligatoria", DELETE_ON_RECORD_PAGE:"Para eliminar, abre el registro", INVALID_TIME:"Usa una hora como 8:00 o 5:30pm", SAME_TIME:"Entrada y salida no pueden coincidir", PROJECT_REQUIRED:"Elige un proyecto activo", OVERLAP:"Se superpone con el registro del " } },
  ko: { records:"기록", timesheet:"근무표", title:"개인 근무표", hint:"인력과 원하는 날짜 범위를 선택하면 모든 날짜가 표시됩니다. 스프레드시트처럼 출근/퇴근을 입력하거나(8, 830, 17:30, 5:30pm) Excel에서 바로 붙여 넣으세요. 시간은 각 프로젝트의 현지 시간대를 사용합니다.", load:"근무표 불러오기", choose:"인력과 날짜 범위를 선택한 후 근무표를 불러오세요.", defaultProject:"새 기록 기본 프로젝트", defaultIn:"기본 출근", defaultOut:"기본 퇴근", fillBlank:"빈 날짜 채우기", weekdaysOnly:"평일만", projectSite:"프로젝트 / 현장", in:"출근", out:"퇴근", entry:"유형", nextDay:"다음 날", addShift:"이 날짜에 근무 추가", removeShift:"저장되지 않은 행 제거", openRecord:"기록 열기", newEntry:"새 기록", edited:"수정됨", workerPunch:"인력 출퇴근", locked:"하루 이상 지속됨 — 기록 페이지에서 수정하세요", unsaved:(count:number)=>`저장되지 않은 변경 ${count}개`, reason:"사유(감사 로그에 저장)", defaultReason:"근무표에서 관리자가 직접 확인함", save:"변경 저장", saving:(done:number,total:number)=>`저장 중 ${done} / ${total}…`, discard:"변경 취소", saved:(count:number)=>`${count}개 행 저장됨`, partial:(saved:number,failed:number)=>`${saved}개 저장, ${failed}개 확인 필요`, confirmDiscard:"저장되지 않은 근무표 변경이 있습니다. 취소할까요?", total:"합계", daysWorked:"근무일", fixFirst:(count:number)=>`저장하기 전에 ${count}개 행을 수정하세요`, saveFailed:"이 행을 저장하지 못했습니다", issues:{ BOTH_TIMES_REQUIRED:"출근과 퇴근을 모두 입력하세요", CHECK_IN_REQUIRED:"출근 시간은 필수입니다", DELETE_ON_RECORD_PAGE:"삭제하려면 기록을 여세요", INVALID_TIME:"8:00 또는 5:30pm 형식으로 입력하세요", SAME_TIME:"출근과 퇴근이 같을 수 없습니다", PROJECT_REQUIRED:"진행 중인 프로젝트를 선택하세요", OVERLAP:"다음 날짜의 기록과 겹칩니다: " } },
} as const;

function one(value: any) { return Array.isArray(value) ? value[0] : value; }
function initials(name = "") { return name.split(/\s+/).map((part) => part[0]).join("").slice(0,2).toUpperCase() || "—"; }
function resolveIntlLocale(locale: string) { return locale in intlLocales ? intlLocales[locale as Locale] : locale; }
function formatDate(value?: string, locale = "en-US", timeZone?: string) { return timeZone ? formatLocalDate(value,timeZone,resolveIntlLocale(locale)) : value ? new Intl.DateTimeFormat(resolveIntlLocale(locale),{month:"short",day:"2-digit",year:"numeric"}).format(new Date(value)) : "—"; }
function formatTime(value?: string, locale = "en-US", timeZone?: string) { return timeZone ? formatLocalTime(value,timeZone,resolveIntlLocale(locale)) : value ? new Intl.DateTimeFormat(resolveIntlLocale(locale),{hour:"2-digit",minute:"2-digit"}).format(new Date(value)) : "—"; }
function formatHours(seconds?: number | null) { return seconds == null ? "—" : (seconds / 3600).toFixed(2); }
function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2,"0");
  const day = String(date.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
}
function localDateRange(dateValue: string) {
  const [year,month,day] = dateValue.split("-").map(Number);
  return { start:new Date(year,month - 1,day), end:new Date(year,month - 1,day + 1) };
}
function dashboardEndpoint(dateValue = localDateValue()) {
  const selected = localDateRange(dateValue);
  const today = localDateRange(localDateValue());
  const params = new URLSearchParams({
    date:dateValue,
    start:selected.start.toISOString(),
    end:selected.end.toISOString(),
    today_start:today.start.toISOString(),
    today_end:today.end.toISOString(),
  });
  return `/api/admin/dashboard?${params.toString()}`;
}

function StatusBadge({ status, t }: { status: string; t: T }) {
  const normalized = status.toLowerCase();
  const label = normalized === "complete" ? t.complete : normalized === "missing_checkout" ? t.missing : normalized === "void" ? t.deleted : normalized === "open" || normalized === "active" ? t.active : status.replaceAll("_"," ");
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
  const { locale, setLocale } = useLanguage();
  const t = text[locale];
  const [menuOpen,setMenuOpen] = useState(false);
  const [modal,setModal] = useState<ModalState>(null);
  const [data,setData] = useState<Row>({});
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [attendanceEndpoint,setAttendanceEndpoint] = useState("/api/admin/attendance");
  const loadErrorRef = useRef(t.loadError);
  const id = pathname.split("/").filter(Boolean).at(-1) || "";
  const activeNav = view === "project-detail" ? "projects" : view === "attendance-detail" || view === "attendance-timesheet" ? "attendance" : view;
  const selectedAttendanceWorkerId = useMemo(() => new URLSearchParams(attendanceEndpoint.split("?")[1]||"").get("worker")||"",[attendanceEndpoint]);

  const endpoint = useMemo(() => {
    if (view === "dashboard") return "/api/admin/dashboard";
    if (view === "users") return "/api/admin/users";
    if (view === "projects") return "/api/admin/projects";
    if (view === "project-detail") return `/api/admin/projects/${id}`;
    if (view === "assignments") return "/api/admin/project-assignments?active_only=true";
    if (view === "reports") return "/api/admin/project-assignments";
    if (view === "attendance-timesheet") return "/api/admin/project-assignments?active_only=true";
    if (view === "attendance") return attendanceEndpoint;
    if (view === "attendance-detail") return `/api/admin/attendance/${id}`;
    return "/api/admin/audit-logs";
  }, [attendanceEndpoint,id,view]);

  const load = useCallback(async (customEndpoint?: string) => {
    if (view === "attendance" && customEndpoint && customEndpoint !== attendanceEndpoint) {
      setAttendanceEndpoint(customEndpoint);
      return;
    }
    setLoading(true); setError("");
    try {
      const response = await fetch(customEndpoint || endpoint,{cache:"no-store"});
      if (response.status === 401 || response.status === 403) { router.replace("/"); return; }
      if (!response.ok) throw new Error("LOAD_FAILED");
      const payload = await response.json();
      setData(payload);
    } catch { setError(loadErrorRef.current); } finally { setLoading(false); }
  },[attendanceEndpoint,endpoint,router,view]);
  useEffect(()=>{loadErrorRef.current=t.loadError},[t.loadError]);
  useEffect(()=>{const timer=window.setTimeout(()=>{void load(view==="dashboard"?dashboardEndpoint():undefined)},0);return()=>window.clearTimeout(timer)},[load,view]);
  function flash(message:string){setNotice(message);window.setTimeout(()=>setNotice(""),2200);}
  async function logout(){await fetch("/api/auth/logout",{method:"POST"});router.replace("/");router.refresh();}

  return <div className="admin-shell">
    <aside className={`admin-sidebar ${menuOpen?"open":""}`}><div className="admin-brand"><span>现</span><div><strong>现场通</strong><small>ONSITE</small></div><button onClick={()=>setMenuOpen(false)}><X size={20}/></button></div><div className="admin-label">{t.admin}</div><nav>{nav.map(([key,href,Icon])=><Link key={key} href={href} className={activeNav===key?"active":""} onClick={()=>setMenuOpen(false)}><Icon size={18}/><span>{t[key]}</span>{activeNav===key&&<i/>}</Link>)}</nav><Link className="sidebar-password" href="/account/password" onClick={()=>setMenuOpen(false)}><KeyRound size={17}/><span>{t.changePassword}</span></Link><button className="sidebar-user" onClick={logout}><span>AL</span><div><strong>Administrator</strong><small>{t.logout}</small></div><MoreHorizontal size={18}/></button></aside>
    {menuOpen&&<button className="menu-scrim" onClick={()=>setMenuOpen(false)}/>}<main className="admin-main"><header className="admin-topbar"><button className="menu-button" onClick={()=>setMenuOpen(true)}><Menu size={20}/><span>{t.menu}</span></button><div className="admin-search"><Search size={18}/><input placeholder={t.search}/></div><div className="admin-actions"><LanguageSelect locale={locale} setLocale={setLocale}/><button className="notification"><Bell size={18}/><i/></button></div></header>
      <div className="admin-page"><div className="page-title-row"><div><p>{t.today} · {formatDate(new Date().toISOString(),locale)}</p><h1>{t[activeNav as keyof typeof t]}</h1></div>{(view==="dashboard"||view==="users")&&<button className="admin-primary" onClick={()=>setModal({type:"worker"})}><Plus size={17}/>{t.addWorker}</button>}{view==="projects"&&<button className="admin-primary" onClick={()=>setModal({type:"project"})}><Plus size={17}/>{t.addProject}</button>}{view==="attendance"&&<button className="admin-primary" disabled={loading||!(data.demo?demoPeople:data.users)?.length||!(data.demo?demoProjects:data.projects)?.length} onClick={()=>setModal({type:"manual-attendance",record:{users:data.demo?demoPeople:(data.users||[]),projects:data.demo?demoProjects:(data.projects||[]),selected_user_id:selectedAttendanceWorkerId}})}><Plus size={17}/>{manualAttendanceText[locale].add}</button>}</div>
        {view==="dashboard"&&<DashboardView data={data} loading={loading} error={error} load={load} t={t} locale={locale}/>}
        {view==="users"&&<UsersView data={data} loading={loading} error={error} load={load} t={t} onEdit={(record)=>setModal({type:"edit-worker",record})} onReset={(record)=>setModal({type:"reset",record})}/>}
        {view==="projects"&&<ProjectsView data={data} loading={loading} error={error} load={load} t={t}/>}
        {view==="project-detail"&&<ProjectDetail data={data} loading={loading} error={error} load={load} t={t} flash={flash}/>}
        {view==="assignments"&&<AssignmentsView data={data} loading={loading} error={error} load={load} t={t} locale={locale} flash={flash}/>}
        {view==="attendance"&&<AttendanceView
          data={data}
          loading={loading}
          error={error}
          load={load}
          t={t}
          locale={locale}
          filterEndpoint={attendanceEndpoint}
        />}
        {view==="attendance-detail"&&<AttendanceDetail
          data={data}
          loading={loading}
          error={error}
          load={load}
          t={t}
          locale={locale}
          onCorrect={(record)=>setModal({type:"correction",record:{...record,projects:data.demo?demoProjects:(data.projects||[])}})}
          onDelete={(record)=>setModal({type:"delete-attendance",record})}
        />}
        {view==="attendance-timesheet"&&<TimesheetView data={data} loading={loading} error={error} load={load} t={t} locale={locale} flash={flash}/>}
        {view==="reports"&&<ReportsView data={data} loading={loading} error={error} load={load} t={t} locale={locale} flash={flash}/>}
        {view==="audit"&&<AuditView data={data} loading={loading} error={error} load={load} t={t} locale={locale}/>}
      </div></main>
    {modal&&<AdminModal modal={modal} t={t} locale={locale} close={()=>setModal(null)} saved={()=>{setModal(null);if(modal.type==="delete-attendance"){router.replace("/admin/attendance");router.refresh();return;}flash(modal.type==="reset"?t.resetDone:modal.type==="manual-attendance"?manualAttendanceText[locale].created:t.saved);load();}}/>}
    {notice&&<div className="toast"><CheckCircle2 size={18}/>{notice}</div>}
  </div>;
}

function DashboardView({data,loading,error,load,t,locale}:{data:Row;loading:boolean;error:string;load:(endpoint?:string)=>void;t:T;locale:string}) {
  const copy=dashboardText[locale as Locale]||dashboardText.en;
  const stats=data.stats||{};
  const onSite=data.demo?demoSessions.filter((row)=>row.status==="OPEN"):(data.on_site||[]);
  const selectedDate=String(data.selected_date||localDateValue());
  const today=localDateValue();
  const recent=data.demo?demoSessions.filter((row)=>localDateValue(new Date(row.check_in_time))===selectedDate):(data.recent||[]);
  const demoStatPeople=demoSessions.map((row)=>{const worker=one(row.worker)||{};const project=one(row.project)||{};return {id:worker.id,display_name:worker.display_name,company:worker.company,project_name:project.project_name}});
  const statPeople=data.demo?{
    currently_on_site:demoStatPeople.slice(1),checked_in_today:demoStatPeople,checked_out_today:demoStatPeople.slice(0,1),complete_sessions:demoStatPeople.slice(0,1),missing_checkout:[],exceptions:[],
  }:(data.stat_people||{});
  const dailyHours=data.demo?[63,78,54,88,96,34,70]:(data.daily_hours||[]).map((row:Row)=>Number(row.hours||0));
  const maxHours=Math.max(...dailyHours,1);
  const cards=[
    [t.currently,stats.currently_on_site??onSite.length,Users,"green",statPeople.currently_on_site||[]],
    [t.inToday,stats.checked_in_today??(data.demo?2:0),UserRoundCheck,"blue",statPeople.checked_in_today||[]],
    [t.outToday,stats.checked_out_today??(data.demo?1:0),Clock3,"sand",statPeople.checked_out_today||[]],
    [t.sessions,stats.complete_sessions??(data.demo?1:0),CheckCircle2,"purple",statPeople.complete_sessions||[]],
    [t.missing,stats.missing_checkout??0,FileClock,"sand",statPeople.missing_checkout||[]],
    [t.exceptions,stats.exceptions??0,AlertTriangle,"red",statPeople.exceptions||[]],
  ] as [string,number,typeof Users,string,Row[]][];
  const tableTitle=selectedDate===today?copy.todayAttendance:`${formatDate(`${selectedDate}T12:00:00`,locale)} · ${copy.attendanceRecords}`;
  const reload=()=>load(dashboardEndpoint(selectedDate));
  return <PageState loading={loading} error={error} empty={false} retry={reload} t={t}><section className="welcome-strip"><div><p>{t.onSite}</p><h2>{t.live}</h2></div><span><i/>{t.live}</span></section><section className="stat-grid">{cards.map(([label,value,Icon,tone,people])=><article className="stat-card" key={label} title={people.map((person)=>[person.display_name,person.project_name].filter(Boolean).join(" · ")).join("\n")}><div className={`stat-icon ${tone}`}><Icon size={19}/></div><span>{label}</span><strong>{value}</strong><div className="stat-people">{people.slice(0,2).map((person)=><span key={person.id||person.display_name}><i>{initials(person.display_name)}</i><b>{person.display_name}</b></span>)}{people.length===0&&<em>{copy.noPeople}</em>}{people.length>2&&<small>{copy.morePeople(people.length-2)}</small>}</div></article>)}</section><section className="dashboard-grid"><article className="admin-card chart-card"><div className="card-heading"><div><p>{t.hours}</p><span>7 days</span></div><button><CalendarDays size={15}/><ChevronDown size={14}/></button></div><div className="bar-chart"><div className="axis"><span>{maxHours.toFixed(0)}</span><span>{(maxHours/2).toFixed(0)}</span><span>0</span></div>{dailyHours.map((hours:number,index:number)=><div className="bar-column" key={index}><div title={`${hours.toFixed(2)} h`}><i style={{height:`${Math.max(hours?5:0,(hours/maxHours)*100)}%`}}/></div><span>{data.demo?["M","T","W","T","F","S","S"][index]:String(data.daily_hours?.[index]?.day||"").slice(5)}</span></div>)}</div></article><article className="admin-card onsite-card"><div className="card-heading"><div><p>{t.onSite}</p><span>{onSite.length}</span></div></div><div className="onsite-list">{onSite.slice(0,3).map((row:Row)=>{const worker=one(row.worker)||{};const project=one(row.project)||{};const timeZone=getSessionTimeZone(row);return <div key={row.id}><span className="person-avatar green">{initials(worker.display_name)}<i/></span><div><strong>{worker.display_name}</strong><small>{project.project_name}</small></div><time title={timeZone}>{formatTime(row.check_in_time,locale,timeZone)}</time></div>})}{onSite.length>3&&<p className="onsite-more">{copy.morePeople(onSite.length-3)}</p>}</div></article></section><SessionTable sessions={recent} t={t} locale={locale} title={tableTitle} date={selectedDate} maxDate={today} chooseDate={copy.chooseDate} emptyLabel={copy.noAttendance} onDateChange={(date)=>load(dashboardEndpoint(date))}/></PageState>;
}

function SessionTable({sessions,t,locale,title,date,maxDate,chooseDate,emptyLabel,onDateChange}:{sessions:Row[];t:T;locale:string;title?:string;date?:string;maxDate?:string;chooseDate?:string;emptyLabel?:string;onDateChange?:(date:string)=>void}) {
  const copy=timeText[locale as Locale]||timeText.en;
  const manualCopy=manualAttendanceText[locale as Locale]||manualAttendanceText.en;
  return <article className="admin-card table-card"><div className="card-heading attendance-day-heading"><div><p>{title||t.recent}</p><span>{sessions.length} · {copy.localTime}</span></div>{date&&onDateChange&&<label className="attendance-date-picker"><CalendarDays size={15}/><span className="sr-only">{chooseDate}</span><input type="date" value={date} max={maxDate} aria-label={chooseDate} onChange={(event)=>{if(event.target.value)onDateChange(event.target.value)}}/></label>}</div>{sessions.length>0?<div className="table-scroll"><table><thead><tr><th>{copy.localDate}</th><th>{t.worker}</th><th>{t.project}</th><th>{t.checkIn}</th><th>{t.checkOut}</th><th>{t.hours}</th><th>{t.status}</th><th/></tr></thead><tbody>{sessions.map((row)=>{const worker=one(row.worker)||{};const project=one(row.project)||{};const timeZone=getSessionTimeZone(row);return <tr key={row.id}><td><span className="local-time-cell"><strong>{formatDate(row.check_in_time,locale,timeZone)}</strong><small>{timeZone}</small></span></td><td><strong>{worker.display_name||"—"}</strong></td><td>{project.project_name||"—"}</td><td className="mono">{formatTime(row.check_in_time,locale,timeZone)}</td><td className="mono">{formatTime(row.check_out_time,locale,timeZone)}</td><td className="mono">{formatHours(row.duration_seconds)}</td><td><span className="session-status-cell">{row.is_manual_entry&&<span className="manual-entry-badge">{manualCopy.manual}</span>}<StatusBadge status={row.status} t={t}/></span></td><td><Link href={`/admin/attendance/${row.id}`}><ChevronRight size={17}/></Link></td></tr>})}</tbody></table></div>:<div className="daily-attendance-empty"><CalendarDays size={21}/><p>{emptyLabel||t.empty}</p></div>}</article>;
}

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
  return <PageState loading={loading} error={error} empty={!project} retry={load} t={t}>{project&&<div className="detail-layout"><form className="admin-card form-card" onSubmit={save}><div className="card-heading"><div><p>{t.projectInfo}</p><span>{project.project_code}</span></div><StatusBadge status={project.status} t={t}/></div><div className="form-grid"><Field name="project_code" label={t.projectCode} value={project.project_code}/><Field name="project_name" label={t.project} value={project.project_name}/><Field name="customer_name" label={t.customer} value={project.customer_name}/><Field name="site_name" label={t.site} value={project.site_name}/><Field name="address_line_1" label={t.address} value={project.address_line_1} wide/><Field name="address_line_2" label={`${t.address} 2`} value={project.address_line_2} wide/><Field name="city" label="City" value={project.city}/><Field name="state" label="State" value={project.state}/><Field name="postal_code" label="ZIP" value={project.postal_code}/><Field name="country" label="Country" value={project.country}/><TimeZoneField label={t.timezone} value={project.timezone} wide/><Field name="latitude" label={t.latitude} value={project.latitude} type="number" step="0.000001" min="-90" max="90"/><Field name="longitude" label={t.longitude} value={project.longitude} type="number" step="0.000001" min="-180" max="180"/><Field name="start_date" label={t.startDate} value={project.start_date} type="date"/><Field name="end_date" label={t.endDate} value={project.end_date} type="date"/><label><span>{t.status}</span><select name="status" defaultValue={project.status}><option>ACTIVE</option><option>COMPLETED</option><option>ARCHIVED</option></select></label></div><button className="admin-primary save-button"><CheckCircle2 size={17}/>{t.save}</button></form><article className="admin-card map-card"><div className="card-heading"><div><p>{t.mapUpload}</p><span>PNG · JPG · WEBP</span></div></div><div className="project-map-frame">{project.map_url?<img className="real-map-preview" src={project.map_url} alt={t.map}/>:<div className="map-preview-large"><MapPin size={28}/></div>}{coordinates&&<div className="project-coordinate-overlay"><LocateFixed size={13}/><div><span>{t.coordinates}</span><strong>{coordinates}</strong></div></div>}</div><form onSubmit={upload}><input ref={mapInputRef} name="map" type="file" accept="image/png,image/jpeg,image/webp" required hidden disabled={uploadingMap} onChange={(event)=>{if(event.currentTarget.files?.length)event.currentTarget.form?.requestSubmit();}}/><button className="secondary-button map-upload-trigger" type="button" disabled={uploadingMap} onClick={()=>mapInputRef.current?.click()}>{uploadingMap?<LoaderCircle className="spin" size={16}/>:<Upload size={16}/>} {uploadingMap?t.uploadingMap:t.replace}</button>{mapUploadError&&<p className="map-upload-error" role="alert">{mapUploadError}</p>}</form></article></div>}</PageState>
}

function Field({name,label,value,wide,type="text",step,min,max,required}:{name:string;label:string;value?:string|number|null;wide?:boolean;type?:string;step?:string;min?:string;max?:string;required?:boolean}) { return <label className={wide?"wide":""}><span>{label}</span><input name={name} type={type} step={step} min={min} max={max} required={required} defaultValue={value??""}/></label> }

function TimeZoneField({label,value="America/New_York",wide}:{label:string;value?:string|null;wide?:boolean}) {
  const selected=value||"America/New_York";
  const groups=[...new Set(TIME_ZONE_OPTIONS.map((option)=>option.group))];
  const isListed=TIME_ZONE_OPTIONS.some((option)=>option.value===selected);
  return <label className={wide?"wide":""}><span>{label}</span><select name="timezone" defaultValue={selected}>{!isListed&&<option value={selected}>{selected}</option>}{groups.map((group)=><optgroup key={group} label={group}>{TIME_ZONE_OPTIONS.filter((option)=>option.group===group).map((option)=><option key={option.value} value={option.value}>{option.label} · {option.value}</option>)}</optgroup>)}</select></label>;
}

function AssignmentsView({data,loading,error,load,t,locale,flash}:{data:Row;loading:boolean;error:string;load:()=>void;t:T;locale:string;flash:(s:string)=>void}) {
  const copy=assignmentText[locale as Locale]||assignmentText.en;
  const users=data.demo?demoPeople:(data.users||[]);
  const projects=data.demo?demoProjects:(data.projects||[]);
  const assignments=data.assignments||[];
  const [projectId,setProjectId]=useState("");
  const [projectSearch,setProjectSearch]=useState("");
  const [peopleSearch,setPeopleSearch]=useState("");
  const [selectedProjects,setSelectedProjects]=useState<string[]>([]);
  const [selectedPeople,setSelectedPeople]=useState<string[]>([]);
  const [batchSaving,setBatchSaving]=useState(false);
  const activeProjectId=projects.some((project:Row)=>project.id===projectId)?projectId:(projects[0]?.id||"");
  const projectQuery=projectSearch.trim().toLocaleLowerCase();
  const peopleQuery=peopleSearch.trim().toLocaleLowerCase();
  const filteredProjects=projects.filter((project:Row)=>`${project.project_name||""} ${project.project_code||""}`.toLocaleLowerCase().includes(projectQuery));
  const filteredPeople=users.filter((user:Row)=>`${user.display_name||""} ${user.username||""} ${user.company||""}`.toLocaleLowerCase().includes(peopleQuery));
  const selectedProjectIds=selectedProjects.filter((id)=>projects.some((project:Row)=>project.id===id));
  const selectedPeopleIds=selectedPeople.filter((id)=>users.some((user:Row)=>user.id===id));
  const activeAssignments=assignments.filter((assignment:Row)=>assignment.status==="ACTIVE");

  function toggleSelection(id:string,selected:string[],setSelected:(ids:string[])=>void){
    setSelected(selected.includes(id)?selected.filter((value)=>value!==id):[...selected,id]);
  }
  function toggleAllVisible(rows:Row[],selected:string[],setSelected:(ids:string[])=>void){
    const visibleIds=rows.map((row)=>String(row.id));
    const allSelected=visibleIds.length>0&&visibleIds.every((id)=>selected.includes(id));
    setSelected(allSelected?selected.filter((id)=>!visibleIds.includes(id)):[...new Set([...selected,...visibleIds])]);
  }
  async function toggle(userId:string,assigned:boolean){
    const response=await fetch("/api/admin/project-assignments",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({user_id:userId,project_id:activeProjectId,assigned})});
    if(response.ok){flash(t.saved);load();}else flash(copy.failed);
  }
  async function updateBatch(assigned:boolean){
    if(!selectedPeopleIds.length||!selectedProjectIds.length)return;
    setBatchSaving(true);
    try{
      const response=await fetch("/api/admin/project-assignments",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({user_ids:selectedPeopleIds,project_ids:selectedProjectIds,assigned})});
      if(!response.ok)throw new Error("BATCH_UPDATE_FAILED");
      flash(assigned?copy.added:copy.removed);
      load();
    }catch{flash(copy.failed)}finally{setBatchSaving(false)}
  }

  return <PageState loading={loading} error={error} empty={!users.length||!projects.length} retry={load} t={t}><article className="admin-card bulk-assignment-card"><div className="bulk-assignment-heading"><div className="report-icon"><UserRoundCheck size={22}/></div><div><h2>{copy.bulkTitle}</h2><p>{copy.bulkDescription}</p></div></div><div className="bulk-assignment-grid"><section className="bulk-picker"><header><div><strong>{copy.selectProjects}</strong><span>{copy.selected}: {selectedProjectIds.length}</span></div><div><button type="button" onClick={()=>toggleAllVisible(filteredProjects,selectedProjectIds,setSelectedProjects)}>{copy.selectResults}</button><button type="button" onClick={()=>setSelectedProjects([])} disabled={!selectedProjectIds.length}>{copy.clear}</button></div></header><label className="bulk-search"><Search size={16}/><input value={projectSearch} onChange={(event)=>setProjectSearch(event.target.value)} placeholder={copy.searchProjects} aria-label={copy.searchProjects}/></label><div className="bulk-choice-list">{filteredProjects.map((project:Row)=>{const selected=selectedProjectIds.includes(project.id);const assignedCount=activeAssignments.filter((assignment:Row)=>assignment.project_id===project.id).length;return <button type="button" className={selected?"selected":""} aria-pressed={selected} key={project.id} onClick={()=>toggleSelection(project.id,selectedProjectIds,setSelectedProjects)}><span className="bulk-choice-mark">{selected?<CheckCircle2 size={16}/>:<Plus size={15}/>}</span><div><strong>{project.project_name}</strong><small>{project.project_code} · {assignedCount} {t.assignedWorkers}</small></div></button>})}{!filteredProjects.length&&<p className="bulk-no-results">{copy.noResults}</p>}</div></section><section className="bulk-picker"><header><div><strong>{copy.selectPeople}</strong><span>{copy.selected}: {selectedPeopleIds.length}</span></div><div><button type="button" onClick={()=>toggleAllVisible(filteredPeople,selectedPeopleIds,setSelectedPeople)}>{copy.selectResults}</button><button type="button" onClick={()=>setSelectedPeople([])} disabled={!selectedPeopleIds.length}>{copy.clear}</button></div></header><label className="bulk-search"><Search size={16}/><input value={peopleSearch} onChange={(event)=>setPeopleSearch(event.target.value)} placeholder={copy.searchPeople} aria-label={copy.searchPeople}/></label><div className="bulk-choice-list">{filteredPeople.map((user:Row)=>{const selected=selectedPeopleIds.includes(user.id);return <button type="button" className={selected?"selected":""} aria-pressed={selected} key={user.id} onClick={()=>toggleSelection(user.id,selectedPeopleIds,setSelectedPeople)}><span className="bulk-choice-mark">{selected?<CheckCircle2 size={16}/>:<Plus size={15}/>}</span><span className="person-avatar green">{initials(user.display_name)}</span><div><strong>{user.display_name}</strong><small>{[user.company,user.username].filter(Boolean).join(" · ")}</small></div></button>})}{!filteredPeople.length&&<p className="bulk-no-results">{copy.noResults}</p>}</div></section></div><footer className="bulk-assignment-footer"><div aria-live="polite"><strong>{copy.summary(selectedPeopleIds.length,selectedProjectIds.length)}</strong><span>{selectedPeopleIds.length&&selectedProjectIds.length?selectedProjects.map((id)=>projects.find((project:Row)=>project.id===id)?.project_name).filter(Boolean).slice(0,3).join(" · "):copy.bulkDescription}</span></div><div><button type="button" className="secondary-button bulk-remove" disabled={batchSaving||!selectedPeopleIds.length||!selectedProjectIds.length} onClick={()=>updateBatch(false)}><X size={16}/>{batchSaving?copy.saving:copy.remove}</button><button type="button" className="admin-primary" disabled={batchSaving||!selectedPeopleIds.length||!selectedProjectIds.length} onClick={()=>updateBatch(true)}>{batchSaving?<LoaderCircle className="spin" size={16}/>:<Plus size={16}/>} {batchSaving?copy.saving:copy.assign}</button></div></footer></article><section className="quick-assignment-section"><div className="quick-assignment-heading"><div><h2>{copy.quickTitle}</h2><p>{t.project}</p></div><div className="assignment-selector"><label>{t.project}<select value={activeProjectId} onChange={(event)=>setProjectId(event.target.value)}>{projects.map((project:Row)=><option value={project.id} key={project.id}>{project.project_name}</option>)}</select></label></div></div><div className="assignment-grid"><article className="admin-card assignment-panel"><div className="card-heading"><div><p>{t.availableWorkers}</p><span>{users.length}</span></div></div><div className="assignment-list">{users.map((user:Row)=>{const assigned=activeAssignments.some((assignment:Row)=>assignment.user_id===user.id&&assignment.project_id===activeProjectId);return <button type="button" key={user.id} onClick={()=>toggle(user.id,!assigned)}><span className="person-avatar green">{initials(user.display_name)}</span><div><strong>{user.display_name}</strong><small>{user.company}</small></div>{assigned?<X size={16}/>:<Plus size={17}/>}</button>})}</div></article><article className="admin-card assignment-panel"><div className="card-heading"><div><p>{t.assignedWorkers}</p><span>{activeAssignments.filter((assignment:Row)=>assignment.project_id===activeProjectId).length}</span></div></div><div className="assignment-list">{activeAssignments.filter((assignment:Row)=>assignment.project_id===activeProjectId).map((assignment:Row)=>{const user=one(assignment.user)||{};return <button type="button" key={assignment.id} onClick={()=>toggle(assignment.user_id,false)}><span className="person-avatar green">{initials(user.display_name)}</span><div><strong>{user.display_name}</strong><small>{user.company}</small></div><X size={16}/></button>})}</div></article></div></section></PageState>
}

function AttendanceView({data,loading,error,load,t,locale,filterEndpoint}:{data:Row;loading:boolean;error:string;load:(u?:string)=>void;t:T;locale:string;filterEndpoint:string}) { const sessions=data.demo?demoSessions:(data.sessions||[]);const projects=data.demo?demoProjects:(data.projects||[]);const users=data.demo?demoPeople:(data.users||[]);const customers=[...new Set(projects.map((project:Row)=>project.customer_name).filter(Boolean))];const companies=[...new Set(users.map((user:Row)=>user.company).filter(Boolean))];const all=locale==="zh"?"全部":locale==="es"?"Todos":locale==="ko"?"전체":"All";const filters=new URLSearchParams(filterEndpoint.split("?")[1]||"");function filter(event:FormEvent<HTMLFormElement>){event.preventDefault();const values=new FormData(event.currentTarget);const query=new URLSearchParams();values.forEach((value,key)=>{if(value)query.set(key,String(value))});load(`/api/admin/attendance?${query}`)}return <><AttendanceTabs active="records" locale={locale}/><form key={filterEndpoint} className="filter-grid attendance-filters" onSubmit={filter}><label>{t.customer}<select name="customer" defaultValue={filters.get("customer")||""}><option value="">{all}</option>{customers.map((customer)=><option key={String(customer)}>{String(customer)}</option>)}</select></label><label>{t.project}<select name="project" defaultValue={filters.get("project")||""}><option value="">{all}</option>{projects.map((project:Row)=><option key={project.id} value={project.id}>{project.project_name}</option>)}</select></label><label>{t.worker}<select name="worker" defaultValue={filters.get("worker")||""}><option value="">{all}</option>{users.map((user:Row)=><option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label><label>{t.company}<select name="company" defaultValue={filters.get("company")||""}><option value="">{all}</option>{companies.map((company)=><option key={String(company)}>{String(company)}</option>)}</select></label><label>{t.startDate}<input name="start" type="date" defaultValue={filters.get("start")||""}/></label><label>{t.endDate}<input name="end" type="date" defaultValue={filters.get("end")||""}/></label><label>{t.status}<select name="status" defaultValue={filters.get("status")||""}><option value="">{all}</option>{["OPEN","COMPLETE","MISSING_CHECKOUT","LONG_SESSION","MANUALLY_CORRECTED"].map((status)=><option key={status}>{status}</option>)}</select></label><button><SlidersHorizontal size={16}/>{t.filter}</button></form><PageState loading={loading} error={error} empty={!sessions.length} retry={()=>load()} t={t}><SessionTable sessions={sessions} t={t} locale={locale}/></PageState></> }

function AttendanceTabs({active,locale,canLeave}:{active:"records"|"timesheet";locale:string;canLeave?:()=>boolean}) {
  const copy=timesheetText[locale as Locale]||timesheetText.en;
  const tabs=[["records","/admin/attendance",ClipboardCheck,copy.records],["timesheet","/admin/attendance/timesheet",Table2,copy.timesheet]] as const;
  return <nav className="attendance-tabs">{tabs.map(([key,href,Icon,label])=><Link key={key} href={href} className={active===key?"active":""} aria-current={active===key?"page":undefined} onClick={(event)=>{if(active!==key&&canLeave&&!canLeave())event.preventDefault()}}><Icon size={16}/>{label}</Link>)}</nav>;
}

function timesheetSessionInput(row:Row):TimesheetSessionInput {
  const project=one(row.project)||{};
  const checkInEvent=one(row.check_in_event)||{};
  return {
    id:String(row.id),
    project_id:String(row.project_id||project.id||""),
    project_name:String(checkInEvent.project_name_snapshot||project.project_name||""),
    site_name:String(checkInEvent.site_name_snapshot||project.site_name||""),
    check_in_time:String(row.check_in_time),
    check_out_time:row.check_out_time||null,
    status:String(row.status||""),
    is_manual_entry:Boolean(row.is_manual_entry),
    timezone:getSessionTimeZone(row),
  };
}

function TimesheetView({data,loading,error,load,t,locale,flash}:{data:Row;loading:boolean;error:string;load:()=>void;t:T;locale:string;flash:(s:string)=>void}) {
  const copy=timesheetText[locale as Locale]||timesheetText.en;
  const manualCopy=manualAttendanceText[locale as Locale]||manualAttendanceText.en;
  const languageLocale=resolveIntlLocale(locale);
  const users:Row[]=useMemo(()=>data.demo?demoPeople:(data.users||[]),[data]);
  const projects:Row[]=useMemo(()=>data.demo?demoProjects:(data.projects||[]),[data]);
  const projectZones=useMemo(()=>projects.map((project)=>({id:String(project.id),timezone:String(project.timezone||"UTC")})),[projects]);
  const today=localDateValue();
  const [workerId,setWorkerId]=useState("");
  const [start,setStart]=useState(`${today.slice(0,8)}01`);
  const [end,setEnd]=useState(today);
  const [loaded,setLoaded]=useState<{workerId:string;start:string;end:string}|null>(null);
  const [rows,setRows]=useState<TimesheetRow[]>([]);
  const [rowErrors,setRowErrors]=useState<Record<string,string>>({});
  const [defaultProjectId,setDefaultProjectId]=useState("");
  const [fillIn,setFillIn]=useState("08:00");
  const [fillOut,setFillOut]=useState("17:00");
  const [weekdaysOnly,setWeekdaysOnly]=useState(true);
  const [reason,setReason]=useState<string|null>(null);
  const [fetching,setFetching]=useState(false);
  const [fetchError,setFetchError]=useState("");
  const [saving,setSaving]=useState<{done:number;total:number}|null>(null);
  const activeDefaultProjectId=projects.some((project)=>project.id===defaultProjectId)?defaultProjectId:String(projects[0]?.id||"");
  const saveReason=reason??copy.defaultReason;
  const issues=useMemo(()=>validateTimesheetRows(rows,projectZones),[rows,projectZones]);
  const dirtyKeys=useMemo(()=>new Set(rows.filter(isRowDirty).map((row)=>row.key)),[rows]);
  const issueCount=Object.keys(issues).length;
  const dirtyCount=dirtyKeys.size;
  const durations=useMemo(()=>new Map(rows.map((row)=>[row.key,rowDurationSeconds(row,projectZones)])),[rows,projectZones]);
  const totalSeconds=[...durations.values()].reduce<number>((sum,value)=>sum+(value||0),0);
  const daysWorked=new Set(rows.filter((row)=>durations.get(row.key)).map((row)=>row.date)).size;
  const loadedWorker=users.find((user)=>user.id===loaded?.workerId);
  const normalizedFillIn=normalizeTimeInput(fillIn);
  const normalizedFillOut=normalizeTimeInput(fillOut);
  const weekdayFormat=useMemo(()=>new Intl.DateTimeFormat(languageLocale,{weekday:"short",timeZone:"UTC"}),[languageLocale]);

  useEffect(()=>{
    if(!dirtyCount)return;
    function warn(event:BeforeUnloadEvent){event.preventDefault();event.returnValue="";}
    window.addEventListener("beforeunload",warn);
    return()=>window.removeEventListener("beforeunload",warn);
  },[dirtyCount]);

  function canDiscard(){return !dirtyCount||window.confirm(copy.confirmDiscard);}

  async function fetchRows(target:{workerId:string;start:string;end:string},drafts:TimesheetRow[]=[]){
    setFetching(true);setFetchError("");
    try{
      const query=new URLSearchParams({worker:target.workerId,start:target.start,end:target.end});
      const response=await fetch(`/api/admin/attendance?${query}`,{cache:"no-store"});
      if(!response.ok)throw new Error("LOAD_FAILED");
      const payload=await response.json();
      const sessions=(payload.sessions||[]).map(timesheetSessionInput);
      const latest=[...sessions].sort((a,b)=>Date.parse(b.check_in_time)-Date.parse(a.check_in_time)).find((session)=>projects.some((project)=>project.id===session.project_id));
      const newRowProjectId=drafts.length||!latest?activeDefaultProjectId:latest.project_id;
      if(newRowProjectId!==activeDefaultProjectId)setDefaultProjectId(newRowProjectId);
      const fresh=buildTimesheetRows({start:target.start,end:target.end,sessions,defaultProjectId:newRowProjectId});
      setRows(drafts.length?mergeFailedDrafts(fresh,drafts):fresh);
      setLoaded(target);
    }catch{setFetchError(t.loadError)}finally{setFetching(false)}
  }

  function loadTimesheet(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!workerId||!start||!end||start>end||!canDiscard())return;
    setRowErrors({});
    void fetchRows({workerId,start,end});
  }

  function updateRow(key:string,patch:Partial<TimesheetRow>){
    setRows((current)=>current.map((row)=>row.key===key?{...row,...patch}:row));
    setRowErrors((current)=>{if(!current[key])return current;const next={...current};delete next[key];return next;});
  }

  function focusCell(index:number,field:"checkIn"|"checkOut",step:1|-1){
    for(let target=index;target>=0&&target<rows.length;target+=step){
      const input=document.querySelector<HTMLInputElement>(`[data-timesheet-cell="${field}-${target}"]`);
      if(input&&!input.disabled){input.focus();input.select();return;}
    }
  }

  function cellKeyDown(event:KeyboardEvent<HTMLInputElement>,index:number,field:"checkIn"|"checkOut"){
    if(event.key==="Enter"||event.key==="ArrowDown"){event.preventDefault();focusCell(index+1,field,1);}
    if(event.key==="ArrowUp"){event.preventDefault();focusCell(index-1,field,-1);}
  }

  function cellPaste(event:ClipboardEvent<HTMLInputElement>,row:TimesheetRow,field:"checkIn"|"checkOut"){
    const pasted=event.clipboardData.getData("text");
    if(!/[\t\n]/.test(pasted.trim()))return;
    event.preventDefault();
    setRows((current)=>applyPastedTimes(current,row.key,field,pasted));
  }

  function issueMessage(issue:TimesheetIssue){return issue.code==="OVERLAP"?`${copy.issues.OVERLAP}${issue.conflictDate}`:copy.issues[issue.code];}

  async function save(){
    if(!loaded||saving||issueCount||!saveReason.trim())return;
    const requests=buildSaveRequests(rows,projectZones,{workerId:loaded.workerId,reason:saveReason.trim()});
    if(!requests.length)return;
    const failures:Record<string,string>={};
    setSaving({done:0,total:requests.length});
    for(const [index,request] of requests.entries()){
      try{
        const response=await fetch(request.url,{method:request.method,headers:{"content-type":"application/json"},body:JSON.stringify(request.body)});
        if(!response.ok){
          const result=await response.json().catch(()=>({}));
          failures[request.key]=result.error==="ATTENDANCE_TIME_OVERLAP"?manualCopy.overlap:String(result.message||result.error||copy.saveFailed);
        }
      }catch{failures[request.key]=copy.saveFailed;}
      setSaving({done:index+1,total:requests.length});
    }
    await fetchRows(loaded,rows.filter((row)=>failures[row.key]));
    setRowErrors(failures);
    setSaving(null);
    const failedCount=Object.keys(failures).length;
    flash(failedCount?copy.partial(requests.length-failedCount,failedCount):copy.saved(requests.length));
  }

  function rowProblem(row:TimesheetRow){return rowErrors[row.key]||(issues[row.key]?issueMessage(issues[row.key]):"");}

  function entryCell(row:TimesheetRow){
    if(rowProblem(row))return <span className="timesheet-issue"><AlertTriangle size={14}/></span>;
    if(row.locked)return <span className="timesheet-muted">{copy.locked}</span>;
    if(dirtyKeys.has(row.key))return <span className={`timesheet-change ${row.original?"edited":"new"}`}>{row.original?copy.edited:copy.newEntry}</span>;
    if(!row.original)return <span className="timesheet-muted">—</span>;
    return <span className="session-status-cell">{row.isManualEntry?<span className="manual-entry-badge">{manualCopy.manual}</span>:<span className="timesheet-muted">{copy.workerPunch}</span>}<StatusBadge status={row.status||""} t={t}/></span>;
  }

  return <PageState loading={loading} error={error} empty={!users.length||!projects.length} retry={load} t={t}><AttendanceTabs active="timesheet" locale={locale} canLeave={canDiscard}/><div className="timesheet-workspace">
    <form className="admin-card timesheet-controls" onSubmit={loadTimesheet}>
      <div className="report-builder-heading"><div className="report-icon"><Table2 size={24}/></div><div><h2>{copy.title}</h2><p>{copy.hint}</p></div></div>
      <div className="timesheet-filter-grid">
        <label>{t.worker}<select value={workerId} required onChange={(event)=>setWorkerId(event.target.value)}><option value="">{manualCopy.worker}</option>{users.map((user)=><option key={user.id} value={user.id}>{user.display_name}{user.company?` · ${user.company}`:""}</option>)}</select></label>
        <label>{t.startDate}<input type="date" value={start} max={end||undefined} required onChange={(event)=>setStart(event.target.value)}/></label>
        <label>{t.endDate}<input type="date" value={end} min={start||undefined} required onChange={(event)=>setEnd(event.target.value)}/></label>
        <button className="admin-primary" type="submit" disabled={fetching||Boolean(saving)||!workerId}>{fetching?<LoaderCircle className="spin" size={17}/>:<CalendarRange size={17}/>}{fetching?t.loading:copy.load}</button>
      </div>
      {fetchError&&<p className="report-error" role="alert">{fetchError}</p>}
    </form>

    {!loaded?<article className="admin-card report-empty-preview"><Table2 size={30}/><h2>{copy.timesheet}</h2><p>{copy.choose}</p></article>:<>
      <section className="admin-card timesheet-fill">
        <label className="wide">{copy.defaultProject}<select value={activeDefaultProjectId} onChange={(event)=>setDefaultProjectId(event.target.value)}>{projects.map((project)=><option key={project.id} value={project.id}>{project.project_name}{project.site_name?` · ${project.site_name}`:""}</option>)}</select></label>
        <label>{copy.defaultIn}<input value={fillIn} onChange={(event)=>setFillIn(event.target.value)} onBlur={()=>{if(normalizedFillIn)setFillIn(normalizedFillIn)}} aria-invalid={!normalizedFillIn}/></label>
        <label>{copy.defaultOut}<input value={fillOut} onChange={(event)=>setFillOut(event.target.value)} onBlur={()=>{if(normalizedFillOut)setFillOut(normalizedFillOut)}} aria-invalid={!normalizedFillOut}/></label>
        <label className="check-label"><input type="checkbox" checked={weekdaysOnly} onChange={(event)=>setWeekdaysOnly(event.target.checked)}/><span>{weekdaysOnly?"✓":""}</span>{copy.weekdaysOnly}</label>
        <button type="button" className="secondary-button" disabled={Boolean(saving)||!normalizedFillIn||!normalizedFillOut} onClick={()=>setRows((current)=>fillBlankRows(current,{projectId:activeDefaultProjectId,checkIn:normalizedFillIn||"",checkOut:normalizedFillOut||"",weekdaysOnly}))}><Wand2 size={16}/>{copy.fillBlank}</button>
      </section>

      <article className="admin-card timesheet-card">
        <div className="card-heading"><div><p>{loadedWorker?.display_name||"—"}</p><span>{loaded.start} — {loaded.end} · {timeText[locale as Locale].localTime}</span></div></div>
        <fieldset className="timesheet-grid-scroll" disabled={Boolean(saving)}>
          <table className="timesheet-grid">
            <thead><tr><th>{t.date}</th><th>{copy.projectSite}</th><th>{copy.in}</th><th>{copy.out}</th><th>{t.hours}</th><th>{copy.entry}</th><th><span className="sr-only">{t.action}</span></th></tr></thead>
            <tbody>{rows.map((row,index)=>{
              const firstOfDay=index===0||rows[index-1].date!==row.date;
              const duration=durations.get(row.key);
              const checkIn=normalizeTimeInput(row.checkIn);
              const checkOut=normalizeTimeInput(row.checkOut);
              const overnight=Boolean(checkIn&&checkOut&&checkOut<=checkIn);
              const knownProject=projects.some((project)=>project.id===row.projectId);
              const removable=!row.original&&(rows.filter((other)=>other.date===row.date).length>1||dirtyKeys.has(row.key));
              const problem=rowProblem(row);
              const className=[firstOfDay?"day-start":"",isWeekend(row.date)?"weekend":"",dirtyKeys.has(row.key)?"dirty":"",problem?"invalid":"",row.locked?"locked":""].filter(Boolean).join(" ");
              return <Fragment key={row.key}><tr className={className}>
                <th scope="row">{firstOfDay?<span className="timesheet-date"><strong>{row.date}</strong><small>{weekdayFormat.format(new Date(`${row.date}T00:00:00Z`))}</small></span>:<span className="timesheet-date continued" title={row.date}>↳</span>}</th>
                <td><select aria-label={`${copy.projectSite} ${row.date}`} value={row.projectId} disabled={row.locked} onChange={(event)=>updateRow(row.key,{projectId:event.target.value})}>{!row.projectId&&<option value="">—</option>}{row.projectId&&!knownProject&&<option value={row.projectId}>{row.projectName||row.projectId}{row.siteName?` · ${row.siteName}`:""}</option>}{projects.map((project)=><option key={project.id} value={project.id}>{project.project_name}{project.site_name?` · ${project.site_name}`:""}</option>)}</select><small>{rowTimeZone(row,projectZones)}</small></td>
                {(["checkIn","checkOut"] as const).map((field)=><td key={field}><div className="timesheet-time"><input data-timesheet-cell={`${field}-${index}`} aria-label={`${field==="checkIn"?copy.in:copy.out} ${row.date}`} value={row[field]} placeholder="--:--" disabled={row.locked} autoComplete="off" spellCheck={false} onChange={(event)=>updateRow(row.key,{[field]:event.target.value})} onBlur={(event)=>{const normalized=normalizeTimeInput(event.target.value);if(normalized&&normalized!==row[field])updateRow(row.key,{[field]:normalized})}} onKeyDown={(event)=>cellKeyDown(event,index,field)} onPaste={(event)=>cellPaste(event,row,field)}/>{field==="checkOut"&&overnight&&<span className="next-day-badge" title={copy.nextDay}>+1</span>}</div></td>)}
                <td className="mono">{duration==null?"—":(duration/3600).toFixed(2)}</td>
                <td>{entryCell(row)}</td>
                <td><div className="timesheet-actions">
                  <button type="button" title={copy.addShift} aria-label={copy.addShift} onClick={()=>setRows((current)=>addShiftRow(current,row.date,activeDefaultProjectId))}><Plus size={15}/></button>
                  {removable&&<button type="button" title={copy.removeShift} aria-label={copy.removeShift} onClick={()=>setRows((current)=>removeShiftRow(current,row.key,activeDefaultProjectId))}><X size={15}/></button>}
                  {row.sessionId&&<Link href={`/admin/attendance/${row.sessionId}`} title={copy.openRecord} aria-label={copy.openRecord} onClick={(event)=>{if(!canDiscard())event.preventDefault()}}><ChevronRight size={16}/></Link>}
                </div></td>
              </tr>{problem&&<tr className="timesheet-issue-row"><th aria-hidden="true"/><td colSpan={6}><span className="timesheet-issue" role="alert"><AlertTriangle size={14}/>{problem}</span></td></tr>}</Fragment>;
            })}</tbody>
            <tfoot><tr><th>{copy.total}</th><td>{copy.daysWorked}: {daysWorked}</td><td/><td/><td className="mono">{(totalSeconds/3600).toFixed(2)}</td><td colSpan={2}/></tr></tfoot>
          </table>
        </fieldset>
      </article>

      {(dirtyCount>0||saving)&&<div className="timesheet-savebar" role="region" aria-label={copy.save}>
        <div className="timesheet-savebar-status"><strong>{saving?copy.saving(saving.done,saving.total):copy.unsaved(dirtyCount)}</strong>{issueCount>0&&!saving&&<span className="timesheet-issue"><AlertTriangle size={14}/>{copy.fixFirst(issueCount)}</span>}</div>
        <label className="timesheet-savebar-reason">{copy.reason}<input value={saveReason} maxLength={1000} disabled={Boolean(saving)} onChange={(event)=>setReason(event.target.value)}/></label>
        <div className="timesheet-savebar-actions">
          <button type="button" className="secondary-button" disabled={Boolean(saving)||fetching} onClick={()=>{if(canDiscard()){setRowErrors({});void fetchRows(loaded);}}}><Undo2 size={16}/>{copy.discard}</button>
          <button type="button" className="admin-primary" disabled={Boolean(saving)||fetching||issueCount>0||!saveReason.trim()} onClick={()=>void save()}>{saving?<LoaderCircle className="spin" size={16}/>:<Save size={16}/>}{copy.save}</button>
        </div>
      </div>}
    </>}
  </div></PageState>;
}

function AttendanceDetail({data,loading,error,load,t,locale,onCorrect,onDelete}:{data:Row;loading:boolean;error:string;load:()=>void;t:T;locale:string;onCorrect:(r:Row)=>void;onDelete:(r:Row)=>void}) {
  const session=data.demo?demoSessions[0]:data.session;const worker=one(session?.worker)||{};const project=one(session?.project)||{};const inEvent=one(session?.check_in_event)||{};const outEvent=one(session?.check_out_event)||{};
  const projectName=inEvent.project_name_snapshot||project.project_name;const customerName=inEvent.customer_name_snapshot||project.customer_name;const siteName=inEvent.site_name_snapshot||project.site_name;const projectAddress=inEvent.project_address_snapshot||[project.address_line_1,project.city,project.state,project.postal_code].filter(Boolean).join(", ");const coordinates=formatProjectCoordinates(inEvent.project_latitude_snapshot??project.latitude,inEvent.project_longitude_snapshot??project.longitude);const timeZone=getSessionTimeZone(session);const copy=timeText[locale as Locale]||timeText.en;
  const manualCopy=manualAttendanceText[locale as Locale]||manualAttendanceText.en;
  return <PageState loading={loading} error={error} empty={!session} retry={load} t={t}>{session&&<><div className="record-hero"><div className="person-cell"><span className="person-avatar green">{initials(worker.display_name)}</span><div><p>{worker.display_name}</p><span>{worker.company}</span></div></div><div><span>{t.project}</span><strong>{projectName}</strong></div><div><span>{copy.localDate}</span><strong>{formatDate(session.check_in_time,locale,timeZone)}</strong><small>{timeZone}</small></div><div className="record-status-stack">{session.is_manual_entry&&<span className="manual-entry-badge">{manualCopy.manual}</span>}<StatusBadge status={session.status} t={t}/></div></div><div className="photo-grid"><PhotoRecord type={t.checkIn} event={inEvent} timestamp={session.check_in_time} url={session.check_in_photo_url} t={t} locale={locale} timeZone={timeZone} manual={Boolean(session.is_manual_entry)}/><PhotoRecord type={t.checkOut} event={outEvent} timestamp={session.check_out_time} url={session.check_out_photo_url} t={t} locale={locale} timeZone={timeZone} manual={Boolean(session.is_manual_entry)}/></div><div className="record-footer"><div><span>{t.total}</span><strong>{formatHours(session.duration_seconds)} h</strong></div><div><span>{t.customer}</span><strong>{customerName||"—"}</strong></div><div><span>{t.site}</span><strong>{siteName||"—"}</strong></div><div><span>{t.snapshot}</span><strong>{projectAddress}</strong></div><div><span>{t.coordinates}</span><strong>{coordinates||"—"}</strong></div><div className="record-action-buttons"><button className="admin-primary" onClick={()=>onCorrect(session)}>{t.correct}</button><button className="danger-button" onClick={()=>onDelete(session)}><Trash2 size={15}/>{deleteAttendanceText[locale as Locale].action}</button></div></div>{session.admin_note&&<article className="admin-card work-summary-record admin-note-record"><header><FileText size={17}/><span>{manualCopy.adminNote}</span></header><p>{session.admin_note}</p></article>}<article className="admin-card work-summary-record"><header><FileText size={17}/><span>{t.workSummary}</span></header><p className={session.daily_work_summary?"":"muted"}>{session.daily_work_summary||t.legacySummary}</p></article></>}</PageState>;
}

function PhotoRecord({type,event,timestamp,url,t,locale,timeZone,manual}:{type:string;event:Row;timestamp?:string|null;url?:string;t:T;locale:string;timeZone:string;manual?:boolean}) {
  const copy=timeText[locale as Locale]||timeText.en;
  const manualCopy=manualAttendanceText[locale as Locale]||manualAttendanceText.en;
  const displayTimestamp=timestamp||event.server_timestamp;
  return <article className="admin-card photo-record">{url?<img className="attendance-photo" src={url} alt={type}/>:<div className="photo-placeholder"><div className="photo-person"><span/><i/></div>{manual&&<p className="manual-photo-note">{manualCopy.noPhoto}</p>}</div>}<div className="photo-meta"><div><span>{type} · {copy.localTime}</span><strong>{formatTime(displayTimestamp,locale,timeZone)}</strong></div><div><span>{t.recordId}</span><strong>{event.record_code||"—"}</strong></div><div><span>{copy.localDate}</span><strong>{formatDate(displayTimestamp,locale,timeZone)}</strong><small>{timeZone}</small></div></div></article>;
}

const ALL_REPORT_PROJECTS="all";

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
  const scopeCopy=reportScopeText[locale as Locale]||reportScopeText.en;
  const activeProjectId=previewProjectId===ALL_REPORT_PROJECTS||projects.some((project:Row)=>project.id===previewProjectId)?previewProjectId:(projects[0]?.id||"");
  const activeWorkerId=users.some((user:Row)=>user.id===previewWorkerId)?previewWorkerId:"";
  const languageLocale=resolveIntlLocale(locale);
  const previewWorkerName=users.find((user:Row)=>user.id===preview?.filters?.worker_id)?.display_name||t.allPersonnel;
  const previewCustomers=[...new Set((preview?.projects||[]).map((project:Row)=>project.customer_name).filter(Boolean))].join(", ")||"—";

  function clearPreview(){setPreview(null);setReportError("");}

  async function runReport(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setRunning(true);setReportError("");
    const body={project_id:activeProjectId===ALL_REPORT_PROJECTS?undefined:activeProjectId,worker_id:activeWorkerId||undefined,start:start||undefined,end:end||undefined};
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
        <label>{t.project}<select name="project_id" value={activeProjectId} onChange={(event)=>{setPreviewProjectId(event.target.value);setPreviewWorkerId("");clearPreview()}}><option value={ALL_REPORT_PROJECTS}>{scopeCopy.allProjects}</option>{projects.map((p:Row)=><option key={p.id} value={p.id}>{p.project_name}</option>)}</select></label>
        <label>{t.worker}<select name="worker_id" value={activeWorkerId} onChange={(event)=>{setPreviewWorkerId(event.target.value);clearPreview()}}><option value="">{t.allPersonnel}</option>{users.map((user:Row)=><option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label>
        <label>{t.startDate}<input name="start" type="date" value={start} max={end||undefined} onChange={(event)=>{setStart(event.target.value);clearPreview()}}/></label>
        <label>{t.endDate}<input name="end" type="date" value={end} min={start||undefined} onChange={(event)=>{setEnd(event.target.value);clearPreview()}}/></label>
        <button className="admin-primary run-report-button" disabled={running} type="submit">{running?<LoaderCircle className="spin" size={17}/>:<FileBarChart size={17}/>} {running?t.runningReport:t.runReport}</button>
      </div>
      {reportError&&<p className="report-error" role="alert">{reportError}</p>}
    </form>

    {!preview?<article className="admin-card report-empty-preview"><FileBarChart size={30}/><h2>{t.reportPreview}</h2><p>{t.reportNotRun}</p></article>:<article className="report-preview">
      <div className="report-preview-toolbar"><div><span>{t.reportReady}</span><strong>{preview.all_projects?scopeCopy.allProjects:preview.project?.project_name}</strong></div><div className="report-export-actions"><label className="check-label"><input type="checkbox" checked={includePhotos} onChange={(event)=>setIncludePhotos(event.target.checked)}/><span>{includePhotos?"✓":""}</span>{t.include}</label><button className="admin-primary" type="button" disabled={downloading!==null} onClick={()=>download("pdf")}><FileText size={16}/>{downloading==="pdf"?t.loading:t.pdf}</button><button className="secondary-button" type="button" disabled={downloading!==null} onClick={()=>download("xlsx")}><ArrowDownToLine size={16}/>{downloading==="xlsx"?t.loading:t.excel}</button><button className="secondary-button" type="button" disabled={downloading!==null} onClick={()=>download("csv")}><ArrowDownToLine size={16}/>{downloading==="csv"?t.loading:t.csv}</button></div></div>
      <div className="report-paper">
        <header><div><strong>{preview.company_name||"—"}</strong><span>ONSITE SUPPORT PORTAL</span></div><p>SITE ATTENDANCE REPORT</p></header>
        {preview.all_projects?<section className="report-project"><div><span>{t.worker}</span><strong>{previewWorkerName}</strong></div><div><span>{t.project}</span><strong>{scopeCopy.projectCount(preview.projects?.length||0)}</strong></div><div className="span-2"><span>{t.period}</span><strong>{preview.filters?.start||"—"} — {preview.filters?.end||"—"}</strong></div><div className="wide"><span>{scopeCopy.customers}</span><strong>{previewCustomers}</strong></div></section>:<section className="report-project"><div><span>{t.customer}</span><strong>{preview.project?.customer_name||"—"}</strong></div><div><span>{t.project}</span><strong>{preview.project?.project_name||"—"}</strong></div><div><span>{t.site}</span><strong>{preview.project?.site_name||"—"}</strong></div><div><span>{t.period}</span><strong>{preview.filters?.start||"—"} — {preview.filters?.end||"—"}</strong></div><div className="wide"><span>{t.address}</span><strong>{preview.project?.address||"—"}</strong></div><div><span>{timeText[locale as Locale].projectTimeZone}</span><strong>{preview.project?.timezone||"UTC"}</strong></div><div><span>{t.coordinates}</span><strong>{formatProjectCoordinates(preview.project?.latitude,preview.project?.longitude)||"—"}</strong></div></section>}
        {preview.project?.map_url&&<div className="report-map-frame"><img src={preview.project.map_url} alt={t.map}/>{formatProjectCoordinates(preview.project?.latitude,preview.project?.longitude)&&<div className="project-coordinate-overlay"><LocateFixed size={13}/><div><span>{t.coordinates}</span><strong>{formatProjectCoordinates(preview.project?.latitude,preview.project?.longitude)}</strong></div></div>}</div>}
        {preview.all_projects&&<section><h3>{scopeCopy.projectsCovered}</h3>{preview.projects?.length?<div className="report-table projects"><div className="report-table-row header"><span>{t.customer}</span><span>{t.project}</span><span>{t.site}</span><span>{timeText[locale as Locale].projectTimeZone}</span><span>{t.workDays}</span><span>{t.hours}</span></div>{preview.projects.map((project:Row)=><div className="report-table-row" key={project.project_id}><span>{project.customer_name||"—"}</span><strong>{project.project_name||"—"}</strong><span>{project.site_name||"—"}</span><span>{project.timezone}</span><span>{project.days_on_site}</span><span>{project.hours}</span></div>)}</div>:<p className="report-no-rows">{t.noReportRows}</p>}</section>}
        <section><h3>{t.total}</h3><div className="report-stat-grid"><div><span>{t.worker}</span><b>{preview.summary?.total_personnel||0}</b></div><div><span>{t.workSessions}</span><b>{preview.summary?.total_work_sessions||0}</b></div><div><span>{t.hours}</span><b>{preview.summary?.total_work_hours||0}</b></div><div><span>{t.workDays}</span><b>{preview.summary?.total_work_days||0}</b></div><div><span>{t.incomplete}</span><b>{preview.summary?.incomplete_sessions||0}</b></div></div></section>
        <section><h3>{t.personnelSummary}</h3>{preview.personnel?.length?<div className="report-table"><div className="report-table-row header"><span>{t.worker}</span><span>{t.company}</span><span>{t.workDays}</span><span>{t.hours}</span></div>{preview.personnel.map((person:Row)=><div className="report-table-row" key={`${person.name}-${person.company}`}><strong>{person.name}</strong><span>{person.company||"—"}</span><span>{person.days_on_site}</span><span>{person.hours}</span></div>)}</div>:<p className="report-no-rows">{t.noReportRows}</p>}</section>
        <section><h3>{t.dailyAttendance} · {timeText[locale as Locale].localTime}</h3>{preview.sessions?.length?<div className={`report-table attendance${preview.all_projects?" with-project":""}`}><div className="report-table-row header"><span>{timeText[locale as Locale].localDate}</span><span>{t.worker}</span>{preview.all_projects&&<span>{t.project}</span>}<span>{t.checkIn}</span><span>{t.checkOut}</span><span>{t.hours}</span><span>{t.status}</span><span>{t.workSummary}</span></div>{preview.sessions.map((session:Row)=><div className="report-table-row" key={session.id}><strong title={session.timezone}>{session.date}</strong><span>{session.worker_name}</span>{preview.all_projects&&<span title={session.timezone}>{session.project_name}</span>}<span>{formatTime(session.check_in,languageLocale,session.timezone)}</span><span>{formatTime(session.check_out,languageLocale,session.timezone)}</span><span>{session.hours??"—"}</span><span>{session.is_manual_entry?manualAttendanceText[locale as Locale].manual:session.status}</span><span className="report-session-notes">{session.daily_work_summary?<b>{session.daily_work_summary}</b>:"—"}</span></div>)}</div>:<p className="report-no-rows">{t.noReportRows}</p>}</section>
      </div>
    </article>}
  </div></PageState>
}

function AuditView({data,loading,error,load,t,locale}:{data:Row;loading:boolean;error:string;load:()=>void;t:T;locale:string}) { const logs=data.logs||[];return <PageState loading={loading} error={error} empty={!logs.length} retry={load} t={t}><article className="admin-card audit-list">{logs.map((log:Row)=><div className="audit-item" key={log.id}><span className="audit-icon"><Activity size={17}/></span><div><strong>{log.action?.replaceAll("_"," ")}</strong><p>{one(log.admin)?.display_name||"Administrator"} · {log.entity_type}</p><blockquote><b>{t.reason}:</b> {log.reason}</blockquote></div><time>{formatDate(log.created_at,locale)} {formatTime(log.created_at,locale)}</time></div>)}</article></PageState> }

function AdminModal({modal,t,locale,close,saved}:{modal:NonNullable<ModalState>;t:T;locale:Locale;close:()=>void;saved:()=>void}) {
  const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  const copy=timeText[locale]||timeText.en;
  const manualCopy=manualAttendanceText[locale]||manualAttendanceText.en;
  const deleteCopy=deleteAttendanceText[locale]||deleteAttendanceText.en;
  const photoCopy=photoUploadText[locale]||photoUploadText.en;
  const summaryCopy=adminWorkSummaryText[locale]||adminWorkSummaryText.en;
  const manualProjects=(modal.record?.projects||[]) as Row[];
  const manualUsers=(modal.record?.users||[]) as Row[];
  const selectedManualUserId=String(modal.record?.selected_user_id||"");
  const manualDefaultUserId=manualUsers.some((user)=>String(user.id)===selectedManualUserId)?selectedManualUserId:String(manualUsers[0]?.id||"");
  const [manualProjectId,setManualProjectId]=useState(String(manualProjects[0]?.id||""));
  const manualProject=manualProjects.find((project)=>String(project.id)===manualProjectId)||manualProjects[0]||{};
  const manualTimeZone=String(manualProject.timezone||"UTC");
  const correctionProjects=modal.type==="correction"?manualProjects:[];
  const originalProjectId=String(modal.record?.project_id||one(modal.record?.project)?.id||"");
  const initialCorrectionProjectId=correctionProjects.some((project)=>String(project.id)===originalProjectId)?originalProjectId:String(correctionProjects[0]?.id||"");
  const [correctionProjectId,setCorrectionProjectId]=useState(initialCorrectionProjectId);
  const correctionProject=correctionProjects.find((project)=>String(project.id)===correctionProjectId)||one(modal.record?.project)||{};
  const correctionTimeZone=correctionProjectId===originalProjectId?getSessionTimeZone(modal.record):String(correctionProject.timezone||"UTC");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");const form=new FormData(event.currentTarget);let url="";let method="POST";let body:Row={};let sendForm=false;
    const workSummary=String(form.get("daily_work_summary")||"").trim();if((modal.type==="correction"||modal.type==="manual-attendance")&&workSummary&&!isWorkSummaryValid(workSummary)){setError(summaryCopy.error);setBusy(false);return;}
    if(modal.type==="worker"){url="/api/admin/users";body=Object.fromEntries(form.entries())}
    if(modal.type==="project"){url="/api/admin/projects";body=Object.fromEntries(form.entries());for(const key of ["address_line_2","site_name","state","postal_code","start_date","end_date","latitude","longitude"]){if(body[key]==="")body[key]=null}for(const key of ["latitude","longitude"]){if(body[key]!=null)body[key]=Number(body[key])}}
    if(modal.type==="edit-worker"){url=`/api/admin/users/${modal.record?.id}`;method="PATCH";body=Object.fromEntries(form.entries())}
    if(modal.type==="reset"){url=`/api/admin/users/${modal.record?.id}/reset-password`;body={password:form.get("password")}}
    if(modal.type==="correction"){url=`/api/admin/work-sessions/${modal.record?.id}`;method="PATCH";sendForm=true}
    if(modal.type==="manual-attendance"){url="/api/admin/attendance/manual";sendForm=true}
    if(modal.type==="delete-attendance"){url=`/api/admin/work-sessions/${modal.record?.id}`;method="DELETE";body={reason:form.get("reason")}}
    const response=await fetch(url,sendForm?{method,body:form}:{method,headers:{"content-type":"application/json"},body:JSON.stringify(body)});if(!response.ok){const result=await response.json();const photoErrors=["UNSUPPORTED_PHOTO_TYPE","PHOTO_SIZE_INVALID","INVALID_PHOTO","ORIGINAL_UPLOAD_FAILED","ORIGINAL_PHOTO_DOWNLOAD_FAILED","WATERMARK_UPLOAD_FAILED","WATERMARK_REGENERATION_FAILED","MANUAL_ATTENDANCE_PHOTO_ATTACH_FAILED","ATTENDANCE_PHOTO_UPDATE_FAILED","ATTENDANCE_PHOTO_CONTEXT_MISSING"];setError(result.error==="ATTENDANCE_TIME_OVERLAP"?manualCopy.overlap:result.error==="CHECK_OUT_PHOTO_REQUIRES_TIME"?manualCopy.checkoutPhotoTime:result.error==="WORK_SUMMARY_TOO_SHORT"?summaryCopy.error:result.error==="DELETION_REASON_REQUIRED"?deleteCopy.reasonError:photoErrors.includes(result.error)?manualCopy.photoError:result.message||result.error||"Request failed");setBusy(false);return;}saved();
  }
  return <div className="modal-scrim"><section className="admin-modal"><header><div><strong>{modal.type==="worker"?t.addWorker:modal.type==="project"?t.addProject:modal.type==="reset"?t.reset:modal.type==="correction"?t.correct:modal.type==="manual-attendance"?manualCopy.title:modal.type==="delete-attendance"?deleteCopy.title:t.edit}</strong><small>{modal.type==="manual-attendance"?manualCopy.noPhoto:modal.type==="delete-attendance"?deleteCopy.warning:modal.type==="correction"&&modal.record?.is_manual_entry?manualCopy.editPhotoHint:modal.record?.display_name||modal.record?.project_name||""}</small></div><button onClick={close}><X size={19}/></button></header><form onSubmit={submit}><div className="modal-form">
    {modal.type==="worker"&&<><Field name="username" label={t.username}/><Field name="password" label={t.password} type="password"/><Field name="display_name" label={t.displayName}/><Field name="company" label={t.company}/><SelectField name="worker_type" label={t.workerType} value="EMPLOYEE" options={["EMPLOYEE","CONTRACTOR","SUBCONTRACTOR","PARTNER","TEMPORARY_WORKER"]}/><SelectField name="role" label={t.role} value="WORKER" options={["WORKER","ADMIN"]}/></>}
    {modal.type==="edit-worker"&&<><Field name="display_name" label={t.displayName} value={modal.record?.display_name}/><Field name="company" label={t.company} value={modal.record?.company}/><SelectField name="worker_type" label={t.workerType} value={modal.record?.worker_type} options={["EMPLOYEE","CONTRACTOR","SUBCONTRACTOR","PARTNER","TEMPORARY_WORKER"]}/><SelectField name="role" label={t.role} value={modal.record?.role} options={["WORKER","ADMIN"]}/><SelectField name="status" label={t.status} value={modal.record?.status} options={["ACTIVE","DISABLED"]}/></>}
    {modal.type==="reset"&&<Field name="password" label={t.password} type="password"/>}
    {modal.type==="project"&&<><Field name="project_code" label={t.projectCode}/><Field name="project_name" label={t.project}/><Field name="customer_name" label={t.customer}/><Field name="site_name" label={t.site}/><Field name="address_line_1" label={t.address}/><Field name="address_line_2" label={`${t.address} 2`}/><Field name="city" label="City"/><Field name="state" label="State"/><Field name="postal_code" label="ZIP"/><Field name="country" label="Country" value="United States"/><TimeZoneField label={t.timezone} value="America/New_York"/><Field name="latitude" label={t.latitude} type="number" step="0.000001" min="-90" max="90"/><Field name="longitude" label={t.longitude} type="number" step="0.000001" min="-180" max="180"/><Field name="start_date" label={t.startDate} type="date"/><Field name="end_date" label={t.endDate} type="date"/></>}
    {modal.type==="correction"&&<><p className="correction-timezone-note wide">{copy.projectCorrectionHint}<br/>{copy.correctionHint(correctionTimeZone)}</p><label className="wide"><span>{t.project}</span><select name="project_id" required value={correctionProjectId} onChange={(event)=>setCorrectionProjectId(event.target.value)}>{correctionProjects.map((project)=><option value={project.id} key={project.id}>{project.project_name} · {project.project_code} · {project.customer_name}</option>)}</select></label><input type="hidden" name="project_timezone" value={correctionTimeZone}/><Field key={`correction-in-${correctionProjectId}`} name="check_in_time" label={`${t.checkIn} · ${copy.localTime}`} value={toZonedDateTimeLocalInput(modal.record?.check_in_time,correctionTimeZone)} type="datetime-local"/><Field key={`correction-out-${correctionProjectId}`} name="check_out_time" label={`${t.checkOut} · ${copy.localTime}`} value={toZonedDateTimeLocalInput(modal.record?.check_out_time,correctionTimeZone)} type="datetime-local"/>{modal.record?.is_manual_entry&&<><PhotoDropField name="check_in_photo" label={manualCopy.checkInPhoto} hint={`${modal.record?.check_in_photo_url?manualCopy.hasPhoto:manualCopy.noPhotoYet} · ${manualCopy.editPhotoHint}`} invalidText={manualCopy.photoError} copy={photoCopy}/><PhotoDropField name="check_out_photo" label={manualCopy.checkOutPhoto} hint={`${modal.record?.check_out_photo_url?manualCopy.hasPhoto:manualCopy.noPhotoYet} · ${manualCopy.editPhotoHint}`} invalidText={manualCopy.photoError} copy={photoCopy}/></>}<label className="wide admin-summary-field"><span>{summaryCopy.label}</span><textarea name="daily_work_summary" defaultValue={modal.record?.daily_work_summary||""} maxLength={WORK_SUMMARY_LIMITS.maximumCharacters} placeholder={summaryCopy.placeholder}/><small>{summaryCopy.rule}</small></label><SelectField name="status" label={t.status} value={["OPEN","COMPLETE","MISSING_CHECKOUT","LONG_SESSION","MANUALLY_CORRECTED"].includes(modal.record?.status)?modal.record?.status:modal.record?.check_out_time?"MANUALLY_CORRECTED":"OPEN"} options={["OPEN","COMPLETE","MISSING_CHECKOUT","LONG_SESSION","MANUALLY_CORRECTED"]}/><label className="wide"><span>{t.reason}</span><textarea name="reason" required minLength={5}/></label></>}
    {modal.type==="manual-attendance"&&<><p className="correction-timezone-note wide">{manualCopy.helper}<br/>{manualCopy.timezone(manualTimeZone)}</p><label><span>{manualCopy.worker}</span><select name="user_id" required defaultValue={manualDefaultUserId}>{manualUsers.map((user)=><option value={user.id} key={user.id}>{user.display_name} · {user.company||user.username}</option>)}</select></label><label><span>{manualCopy.project}</span><select name="project_id" required value={manualProjectId} onChange={(event)=>setManualProjectId(event.target.value)}>{manualProjects.map((project)=><option value={project.id} key={project.id}>{project.project_name} · {project.project_code}</option>)}</select></label><Field key={`in-${manualProjectId}`} name="check_in_time" label={manualCopy.checkIn} value={toZonedDateTimeLocalInput(new Date(),manualTimeZone)} type="datetime-local" required/><Field key={`out-${manualProjectId}`} name="check_out_time" label={manualCopy.checkOut} type="datetime-local"/><PhotoDropField name="check_in_photo" label={manualCopy.checkInPhoto} hint={manualCopy.photoHint} invalidText={manualCopy.photoError} copy={photoCopy}/><PhotoDropField name="check_out_photo" label={manualCopy.checkOutPhoto} hint={manualCopy.photoHint} invalidText={manualCopy.photoError} copy={photoCopy}/><label className="wide admin-summary-field"><span>{summaryCopy.label}</span><textarea name="daily_work_summary" maxLength={WORK_SUMMARY_LIMITS.maximumCharacters} placeholder={summaryCopy.placeholder}/><small>{summaryCopy.rule}</small></label><label className="wide"><span>{manualCopy.note}</span><textarea name="admin_note" maxLength={1000} placeholder={manualCopy.notePlaceholder}/></label></>}
    {modal.type==="delete-attendance"&&<label className="wide delete-reason-field"><span>{deleteCopy.reason}</span><textarea name="reason" required minLength={5} placeholder={deleteCopy.placeholder}/></label>}
  </div>{error&&<p className="modal-error">{error}</p>}<footer><button type="button" className="secondary-button" onClick={close}>{t.cancel}</button><button className={modal.type==="delete-attendance"?"danger-button":"admin-primary"} disabled={busy}>{busy?t.loading:modal.type==="manual-attendance"?manualCopy.create:modal.type==="delete-attendance"?deleteCopy.confirm:t.save}</button></footer></form></section></div> }

function PhotoDropField({name,label,hint,invalidText,copy}:{name:string;label:string;hint:string;invalidText:string;copy:{drop:string;selected:string;clear:string}}) {
  const inputRef=useRef<HTMLInputElement>(null);
  const [fileName,setFileName]=useState("");
  const [dragging,setDragging]=useState(false);
  const [fileError,setFileError]=useState("");
  function chooseFile(file:File){
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size===0||file.size>15*1024*1024){setFileError(invalidText);return;}
    if(!inputRef.current)return;
    const transfer=new DataTransfer();transfer.items.add(file);inputRef.current.files=transfer.files;setFileName(file.name);setFileError("");
  }
  function drop(event:DragEvent<HTMLDivElement>){event.preventDefault();setDragging(false);const file=event.dataTransfer.files[0];if(file)chooseFile(file)}
  function clear(){if(inputRef.current)inputRef.current.value="";setFileName("");setFileError("")}
  return <div className="manual-photo-field"><span>{label}</span><div className={`photo-drop-zone ${dragging?"dragging":""} ${fileName?"selected":""}`} role="button" tabIndex={0} aria-label={label} onClick={()=>inputRef.current?.click()} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();inputRef.current?.click()}}} onDragEnter={(event)=>{event.preventDefault();setDragging(true)}} onDragOver={(event)=>{event.preventDefault();event.dataTransfer.dropEffect="copy";setDragging(true)}} onDragLeave={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDragging(false)}} onDrop={drop}><Upload size={20}/><strong>{fileName||copy.drop}</strong><small>{fileName?`${copy.selected}: ${fileName}`:hint}</small><input ref={inputRef} className="photo-drop-input" name={name} type="file" accept="image/jpeg,image/png,image/webp" onClick={(event)=>event.stopPropagation()} onChange={(event)=>{const file=event.currentTarget.files?.[0];if(file)chooseFile(file)}}/></div>{fileName&&<button className="photo-drop-clear" type="button" onClick={clear}><X size={13}/>{copy.clear}</button>}{fileError&&<small className="photo-drop-error" role="alert">{fileError}</small>}</div>
}

function SelectField({name,label,value,options}:{name:string;label:string;value?:string;options:string[]}) { return <label><span>{label}</span><select name={name} defaultValue={value}>{options.map((option)=><option key={option}>{option}</option>)}</select></label> }
