import ExcelJS from "exceljs";
import { apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { buildReportData, getSessionSnapshot } from "@/lib/report-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { demo } = await requireAuth("ADMIN");
    const body = await request.json() as { project_id?: string; worker_id?: string; start?: string; end?: string };
    const report = demo ? { sessions: [], summary: { total_personnel: 0, total_work_sessions: 0, total_work_hours: 0, total_work_days: 0, incomplete_sessions: 0 }, personnel: [] } : await buildReportData({ projectId: body.project_id, workerId: body.worker_id, start: body.start, end: body.end });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "现场通 OnSite";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Attendance", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = [
      ["Customer","customer",18],["Project","project",24],["Site","site",24],["Project Address","address",34],["Date","date",14],
      ["Worker","worker",20],["Company","company",20],["Worker Type","workerType",18],["Check In","checkIn",24],["Check Out","checkOut",24],
      ["Total Hours","hours",14],["Session Status","status",20],["Check-In Photo Reference","inPhoto",25],["Check-Out Photo Reference","outPhoto",25],
    ].map(([header,key,width]) => ({ header: String(header), key: String(key), width: Number(width) }));
    for (const row of report.sessions) {
      const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
      const snapshot = getSessionSnapshot(row);
      const checkInEvent = Array.isArray(row.check_in_event) ? row.check_in_event[0] : row.check_in_event;
      const checkOutEvent = Array.isArray(row.check_out_event) ? row.check_out_event[0] : row.check_out_event;
      sheet.addRow({ customer: snapshot.customerName, project: snapshot.projectName, site: snapshot.siteName, address: snapshot.address, date: String(row.check_in_time).slice(0,10), worker: worker?.display_name, company: worker?.company, workerType: worker?.worker_type, checkIn: row.check_in_time, checkOut: row.check_out_time || "", hours: row.duration_seconds ? Number((Number(row.duration_seconds)/3600).toFixed(2)) : "", status: row.status, inPhoto: checkInEvent?.record_code || "", outPhoto: checkOutEvent?.record_code || "" });
    }
    sheet.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4C3A" } }; cell.alignment = { vertical: "middle" }; });
    sheet.getRow(1).height = 26;
    sheet.autoFilter = { from: "A1", to: "N1" };
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
