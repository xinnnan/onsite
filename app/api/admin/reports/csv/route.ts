import { apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { buildReportData, getSessionSnapshot } from "@/lib/report-data";
import { DEMO_COMPANY_NAME } from "@/lib/demo";

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function POST(request: Request) {
  try {
    const { demo } = await requireAuth("ADMIN");
    const body = await request.json() as { project_id?: string; worker_id?: string; start?: string; end?: string };
    if (demo) {
      const demoRows = [
        ["Customer","Project","Site","Project Address","Project Latitude","Project Longitude","Date","Worker","Company","Worker Type","Check In","Check Out","Total Hours","Session Status","Daily Work Summary","Check-In Photo Reference","Check-Out Photo Reference"],
        ["adidas","adidas Indy AMR","Indy Manufacturing Facility","8677 Impact Court, Indianapolis, IN 46219",39.780625,-86.045711,"2026-08-17","John Smith",DEMO_COMPANY_NAME,"EMPLOYEE","2026-08-17T12:03:00Z","2026-08-17T21:14:00Z","9.18","COMPLETE","完成 6 台机器人的例行检查，更换 2 个传感器并测试运行状态正常。","ATT-DEMO-IN","ATT-DEMO-OUT"],
      ];
      return new Response("\uFEFF" + demoRows.map((row) => row.map(csvCell).join(",")).join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=onsite-attendance.csv" } });
    }
    const report = await buildReportData({ projectId: body.project_id, workerId: body.worker_id, start: body.start, end: body.end });
    const header = ["Customer","Project","Site","Project Address","Project Latitude","Project Longitude","Date","Worker","Company","Worker Type","Check In","Check Out","Total Hours","Session Status","Daily Work Summary","Check-In Photo Reference","Check-Out Photo Reference"];
    const rows = report.sessions.map((row) => {
      const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
      const snapshot = getSessionSnapshot(row);
      const checkInEvent = Array.isArray(row.check_in_event) ? row.check_in_event[0] : row.check_in_event;
      const checkOutEvent = Array.isArray(row.check_out_event) ? row.check_out_event[0] : row.check_out_event;
      return [snapshot.customerName, snapshot.projectName, snapshot.siteName, snapshot.address, snapshot.latitude, snapshot.longitude, String(row.check_in_time).slice(0,10), worker?.display_name, worker?.company, worker?.worker_type, row.check_in_time, row.check_out_time, row.duration_seconds ? (Number(row.duration_seconds)/3600).toFixed(2) : "", row.status, row.daily_work_summary, checkInEvent?.record_code, checkOutEvent?.record_code];
    });
    const csv = "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=onsite-attendance.csv", "cache-control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
