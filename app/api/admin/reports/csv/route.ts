import { apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { buildReportData, getSessionSnapshot } from "@/lib/report-data";

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function POST(request: Request) {
  try {
    const { demo } = await requireAuth("ADMIN");
    const body = await request.json() as { project_id?: string; worker_id?: string; start?: string; end?: string };
    if (demo) return new Response("Date,Worker,Project,Check In,Check Out,Hours,Status\n", { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=onsite-attendance.csv" } });
    const report = await buildReportData({ projectId: body.project_id, workerId: body.worker_id, start: body.start, end: body.end });
    const header = ["Customer","Project","Site","Project Address","Date","Worker","Company","Worker Type","Check In","Check Out","Total Hours","Session Status","Check-In Photo Reference","Check-Out Photo Reference"];
    const rows = report.sessions.map((row) => {
      const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
      const snapshot = getSessionSnapshot(row);
      const checkInEvent = Array.isArray(row.check_in_event) ? row.check_in_event[0] : row.check_in_event;
      const checkOutEvent = Array.isArray(row.check_out_event) ? row.check_out_event[0] : row.check_out_event;
      return [snapshot.customerName, snapshot.projectName, snapshot.siteName, snapshot.address, String(row.check_in_time).slice(0,10), worker?.display_name, worker?.company, worker?.worker_type, row.check_in_time, row.check_out_time, row.duration_seconds ? (Number(row.duration_seconds)/3600).toFixed(2) : "", row.status, checkInEvent?.record_code, checkOutEvent?.record_code];
    });
    const csv = "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=onsite-attendance.csv", "cache-control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
