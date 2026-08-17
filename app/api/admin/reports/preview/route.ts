import { ApiError, apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { buildReportData, getSessionSnapshot } from "@/lib/report-data";

export const runtime = "nodejs";

type PreviewRequest = {
  project_id?: string;
  worker_id?: string;
  start?: string;
  end?: string;
};

function demoPreview(body: PreviewRequest) {
  return {
    filters: body,
    company_name: "DropLetAI",
    project: {
      customer_name: "adidas",
      project_name: "adidas Indy AMR",
      site_name: "Indy Manufacturing Facility",
      address: "8677 Impact Court, Indianapolis, IN 46219",
    },
    summary: { total_personnel: 0, total_work_sessions: 0, total_work_hours: 0, total_work_days: 0, incomplete_sessions: 0 },
    personnel: [],
    sessions: [],
  };
}

export async function POST(request: Request) {
  try {
    const { demo } = await requireAuth("ADMIN");
    const body = await request.json() as PreviewRequest;
    if (!body.project_id) throw new ApiError(400, "PROJECT_REQUIRED");
    if (body.start && body.end && body.start > body.end) throw new ApiError(400, "INVALID_REPORT_PERIOD");
    if (demo) return Response.json(demoPreview(body), { headers: { "cache-control": "no-store" } });

    const report = await buildReportData({
      projectId: body.project_id,
      workerId: body.worker_id,
      start: body.start,
      end: body.end,
    });
    const first = report.sessions[0];
    const snapshot = first ? getSessionSnapshot(first) : null;
    const project = report.selectedProject;

    return Response.json({
      filters: body,
      company_name: report.companyName,
      project: {
        customer_name: snapshot?.customerName || project?.customer_name || "—",
        project_name: snapshot?.projectName || project?.project_name || "—",
        site_name: snapshot?.siteName || project?.site_name || "—",
        address: snapshot?.address || [project?.address_line_1, project?.address_line_2, project?.city, project?.state, project?.postal_code].filter(Boolean).join(", ") || "—",
      },
      summary: report.summary,
      personnel: report.personnel,
      sessions: report.sessions.slice(0, 250).map((row) => {
        const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
        return {
          id: row.id,
          date: String(row.check_in_time).slice(0, 10),
          worker_name: worker?.display_name || "—",
          company: worker?.company || "—",
          check_in: row.check_in_time,
          check_out: row.check_out_time,
          hours: row.duration_seconds == null ? null : Number((Number(row.duration_seconds) / 3600).toFixed(2)),
          status: row.status,
        };
      }),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
