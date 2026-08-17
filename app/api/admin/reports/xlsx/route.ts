import ExcelJS from "exceljs";
import { apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { buildReportData, getSessionSnapshot } from "@/lib/report-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { demo } = await requireAuth("ADMIN");
    const body = await request.json() as { project_id?: string; worker_id?: string; start?: string; end?: string };
    const report = demo ? { sessions: [{ id: "demo-session", user_id: "demo-worker", project_id: "demo-project", check_in_time: "2026-08-17T12:03:00Z", check_out_time: "2026-08-17T21:14:00Z", duration_seconds: 33060, status: "COMPLETE", daily_work_summary: "完成 6 台机器人的例行检查，更换 2 个传感器并测试运行状态正常。", worker: { id: "demo-worker", display_name: "John Smith", company: "DropLetAI", worker_type: "EMPLOYEE" }, project: { customer_name: "adidas", project_name: "adidas Indy AMR", site_name: "Indy Manufacturing Facility", address_line_1: "8677 Impact Court", city: "Indianapolis", state: "IN", postal_code: "46219", timezone: "America/Indiana/Indianapolis", map_image_path: null, latitude: 39.780625, longitude: -86.045711 }, check_in_event: { record_code: "ATT-DEMO-IN", project_latitude_snapshot: 39.780625, project_longitude_snapshot: -86.045711 }, check_out_event: { record_code: "ATT-DEMO-OUT", project_latitude_snapshot: 39.780625, project_longitude_snapshot: -86.045711 } }], summary: { total_personnel: 1, total_work_sessions: 1, total_work_hours: 9.18, total_work_days: 1, incomplete_sessions: 0 }, personnel: [{ name: "John Smith", company: "DropLetAI", days_on_site: 1, hours: 9.18 }] } : await buildReportData({ projectId: body.project_id, workerId: body.worker_id, start: body.start, end: body.end });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "现场通 OnSite";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Attendance", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = [
      ["Customer","customer",18],["Project","project",24],["Site","site",24],["Project Address","address",34],["Project Latitude","latitude",18],["Project Longitude","longitude",18],["Date","date",14],
      ["Worker","worker",20],["Company","company",20],["Worker Type","workerType",18],["Check In","checkIn",24],["Check Out","checkOut",24],
      ["Total Hours","hours",14],["Session Status","status",20],["Daily Work Summary","workSummary",52],["Check-In Photo Reference","inPhoto",25],["Check-Out Photo Reference","outPhoto",25],
    ].map(([header,key,width]) => ({ header: String(header), key: String(key), width: Number(width) }));
    for (const row of report.sessions) {
      const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
      const snapshot = getSessionSnapshot(row);
      const checkInEvent = Array.isArray(row.check_in_event) ? row.check_in_event[0] : row.check_in_event;
      const checkOutEvent = Array.isArray(row.check_out_event) ? row.check_out_event[0] : row.check_out_event;
      const added = sheet.addRow({ customer: snapshot.customerName, project: snapshot.projectName, site: snapshot.siteName, address: snapshot.address, latitude: snapshot.latitude ?? "", longitude: snapshot.longitude ?? "", date: String(row.check_in_time).slice(0,10), worker: worker?.display_name, company: worker?.company, workerType: worker?.worker_type, checkIn: row.check_in_time, checkOut: row.check_out_time || "", hours: row.duration_seconds ? Number((Number(row.duration_seconds)/3600).toFixed(2)) : "", status: row.status, workSummary: row.daily_work_summary || "", inPhoto: checkInEvent?.record_code || "", outPhoto: checkOutEvent?.record_code || "" });
      added.getCell("workSummary").alignment = { vertical: "top", wrapText: true };
    }
    sheet.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4C3A" } }; cell.alignment = { vertical: "middle" }; });
    sheet.getRow(1).height = 26;
    sheet.autoFilter = { from: "A1", to: "Q1" };
    sheet.eachRow((row, index) => { if (index > 1 && index % 2 === 1) row.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F7F4" } }; }); });

    const summary = workbook.addWorksheet("Summary");
    summary.addRows([["SITE ATTENDANCE REPORT"],[],["Total Personnel", report.summary.total_personnel || 0],["Total Work Sessions", report.summary.total_work_sessions || 0],["Total Work Hours", report.summary.total_work_hours || 0],["Total Work Days", report.summary.total_work_days || 0],["Incomplete Sessions", report.summary.incomplete_sessions || 0],[],["Worker","Company","Days On Site","Hours"]]);
    report.personnel.forEach((row) => summary.addRow([row.name,row.company,row.days_on_site,row.hours]));
    summary.columns = [{ width: 28 },{ width: 24 },{ width: 16 },{ width: 14 }];
    summary.getCell("A1").font = { size: 18, bold: true, color: { argb: "FF0F4C3A" } };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": "attachment; filename=onsite-attendance.xlsx", "cache-control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
