import React from "react";
import { join } from "node:path";
import { Document, Font, Image, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { loadPrivateAssetAsJpegDataUri } from "@/lib/admin-data";
import { buildReportData, getSessionSnapshot } from "@/lib/report-data";
import { formatProjectCoordinates } from "@/lib/project-coordinates";

export const runtime = "nodejs";

const PDF_FONT_FILE = join(process.cwd(), "node_modules", "@expo-google-fonts", "noto-sans-sc", "400Regular", "NotoSansSC_400Regular.ttf");
Font.register({ family: "NotoSansSC", fonts: [{ src: PDF_FONT_FILE, fontWeight: 400 }, { src: PDF_FONT_FILE, fontWeight: 700 }] });

const styles = StyleSheet.create({
  page: { padding: 34, fontSize: 8, color: "#243b35", fontFamily: "NotoSansSC" },
  brand: { fontSize: 16, fontWeight: 700, color: "#0f4c3a" },
  title: { fontSize: 10, marginTop: 4, color: "#49635b" },
  rule: { height: 2, backgroundColor: "#0f4c3a", marginVertical: 14 },
  metadata: { display: "flex", flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  metaBlock: { width: "48%" }, label: { color: "#71827e", fontSize: 7, marginTop: 6 }, value: { fontSize: 9, marginTop: 2 },
  projectMapFrame: { position: "relative", width: "100%", height: 118, marginTop: 10, border: "1 solid #dce5e0" },
  projectMap: { width: "100%", height: "100%", objectFit: "cover" },
  coordinateBadge: { position: "absolute", top: 8, right: 8, paddingVertical: 5, paddingHorizontal: 7, borderRadius: 4, color: "#ffffff", backgroundColor: "#082b22dd" },
  section: { fontSize: 10, color: "#0f4c3a", fontWeight: 700, marginTop: 16, marginBottom: 8 },
  stats: { display: "flex", flexDirection: "row", gap: 6 }, stat: { flex: 1, border: "1 solid #dce5e0", padding: 8 }, statValue: { fontSize: 15, fontWeight: 700, marginTop: 4 },
  table: { borderTop: "1 solid #cbd8d2" }, row: { display: "flex", flexDirection: "row", borderBottom: "1 solid #e2e9e5", minHeight: 22, alignItems: "center" },
  header: { backgroundColor: "#edf4f0", fontWeight: 700 }, cDate: { width: "14%", padding: 4 }, cWorker: { width: "25%", padding: 4 }, cTime: { width: "16%", padding: 4 }, cHours: { width: "13%", padding: 4 }, cStatus: { width: "16%", padding: 4 },
  pWorker: { width: "36%", padding: 4 }, pCompany: { width: "34%", padding: 4 }, pDays: { width: "15%", padding: 4 }, pHours: { width: "15%", padding: 4 },
  summaryDate: { width: "16%", padding: 5 }, summaryWorker: { width: "24%", padding: 5 }, summaryText: { width: "60%", padding: 5, lineHeight: 1.55 },
  photoPage: { padding: 34, fontSize: 8, color: "#243b35", fontFamily: "NotoSansSC" }, photoHeading: { fontSize: 13, fontWeight: 700, color: "#0f4c3a" },
  photoMeta: { marginTop: 5, marginBottom: 16, color: "#63766f" }, photoRow: { display: "flex", flexDirection: "row", gap: 12 }, photoCard: { width: "49%", border: "1 solid #dce5e0", padding: 7 }, photo: { width: "100%", height: 270, objectFit: "contain", backgroundColor: "#edf2ef" }, photoLabel: { marginTop: 7, fontSize: 8, fontWeight: 700 }, photoCode: { marginTop: 3, color: "#71827e", fontSize: 7 },
  footer: { position: "absolute", left: 34, right: 34, bottom: 24, display: "flex", flexDirection: "row", justifyContent: "space-between", color: "#81918c", fontSize: 7 },
});

const h = React.createElement;

export async function POST(request: Request) {
  try {
    const { demo } = await requireAuth("ADMIN");
    const body = await request.json() as { project_id?: string; worker_id?: string; start?: string; end?: string; include_photos?: boolean };
    const report = demo ? { sessions: [{ id: "demo-session", user_id: "demo-worker", project_id: "demo-project", check_in_time: "2026-08-17T12:03:00Z", check_out_time: "2026-08-17T21:14:00Z", duration_seconds: 33060, status: "COMPLETE", daily_work_summary: "完成 6 台机器人的例行检查，更换 2 个传感器并测试运行状态正常。", worker: { id: "demo-worker", display_name: "John Smith", company: "DropLetAI", worker_type: "EMPLOYEE" }, project: { customer_name: "adidas", project_name: "adidas Indy AMR", site_name: "Indy Manufacturing Facility", address_line_1: "8677 Impact Court", city: "Indianapolis", state: "IN", postal_code: "46219", timezone: "America/Indiana/Indianapolis", map_image_path: null, latitude: 39.780625, longitude: -86.045711 }, check_in_event: { record_code: "ATT-DEMO-IN", project_latitude_snapshot: 39.780625, project_longitude_snapshot: -86.045711, watermarked_photo_path: null }, check_out_event: { record_code: "ATT-DEMO-OUT", project_latitude_snapshot: 39.780625, project_longitude_snapshot: -86.045711, watermarked_photo_path: null } }], selectedProject: { customer_name: "adidas", project_name: "adidas Indy AMR", site_name: "Indy Manufacturing Facility", address_line_1: "8677 Impact Court", city: "Indianapolis", state: "IN", postal_code: "46219", map_image_path: null, latitude: 39.780625, longitude: -86.045711 }, companyName: "DropLetAI", summary: { total_personnel: 1,total_work_sessions:1,total_work_hours:9.18,total_work_days:1,incomplete_sessions:0 }, personnel: [{ name: "John Smith", company: "DropLetAI", days_on_site: 1, hours: 9.18 }] } : await buildReportData({ projectId: body.project_id, workerId: body.worker_id, start: body.start, end: body.end });
    const first = report.sessions[0];
    const snapshot = first ? getSessionSnapshot(first) : null;
    const selectedProject = report.selectedProject;
    const project = {
      customerName: snapshot?.customerName || selectedProject?.customer_name || "All customers",
      projectName: snapshot?.projectName || selectedProject?.project_name || "All projects",
      siteName: snapshot?.siteName || selectedProject?.site_name || "-",
      address: snapshot?.address || [selectedProject?.address_line_1, selectedProject?.city, selectedProject?.state, selectedProject?.postal_code].filter(Boolean).join(", ") || "-",
      mapPath: snapshot?.mapPath || selectedProject?.map_image_path || null,
      latitude: snapshot?.latitude ?? selectedProject?.latitude ?? null,
      longitude: snapshot?.longitude ?? selectedProject?.longitude ?? null,
    };
    const projectCoordinates = formatProjectCoordinates(project.latitude, project.longitude);
    const projectMapUrl = await loadPrivateAssetAsJpegDataUri("project-assets", project.mapPath);
    const tableRows = report.sessions.slice(0, 250).map((row) => {
      const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
      return h(View, { style: styles.row, key: row.id },
        h(Text, { style: styles.cDate }, String(row.check_in_time).slice(0,10)),
        h(Text, { style: styles.cWorker }, worker?.display_name || ""),
        h(Text, { style: styles.cTime }, new Date(row.check_in_time).toISOString().slice(11,16)),
        h(Text, { style: styles.cTime }, row.check_out_time ? new Date(row.check_out_time).toISOString().slice(11,16) : "-"),
        h(Text, { style: styles.cHours }, row.duration_seconds ? (Number(row.duration_seconds)/3600).toFixed(2) : "-"),
        h(Text, { style: styles.cStatus }, row.status));
    });
    const personnelRows = report.personnel.map((row) => h(View, { style: styles.row, key: `${row.name}-${row.company}` },
      h(Text, { style: styles.pWorker }, row.name), h(Text, { style: styles.pCompany }, row.company || "-"),
      h(Text, { style: styles.pDays }, String(row.days_on_site)), h(Text, { style: styles.pHours }, String(row.hours))));
    const summaryRows = report.sessions.filter((row) => row.daily_work_summary).slice(0, 250).map((row) => {
      const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
      return h(View, { style: styles.row, key: `summary-${row.id}`, wrap: false },
        h(Text, { style: styles.summaryDate }, String(row.check_in_time).slice(0, 10)),
        h(Text, { style: styles.summaryWorker }, worker?.display_name || ""),
        h(Text, { style: styles.summaryText }, row.daily_work_summary || ""));
    });

    const photoSessions = body.include_photos ? report.sessions.slice(0, 60) : [];
    const photoAssets = await Promise.all(photoSessions.map(async (row) => {
      const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
      const checkInEvent = Array.isArray(row.check_in_event) ? row.check_in_event[0] : row.check_in_event;
      const checkOutEvent = Array.isArray(row.check_out_event) ? row.check_out_event[0] : row.check_out_event;
      const [checkInUrl, checkOutUrl] = await Promise.all([
        loadPrivateAssetAsJpegDataUri("attendance-watermarked", checkInEvent?.watermarked_photo_path),
        loadPrivateAssetAsJpegDataUri("attendance-watermarked", checkOutEvent?.watermarked_photo_path),
      ]);
      return { row, worker, checkInEvent, checkOutEvent, checkInUrl, checkOutUrl };
    }));
    const photoPages = photoAssets.map(({ row, worker, checkInEvent, checkOutEvent, checkInUrl, checkOutUrl }) => h(Page, { size: "A4", style: styles.photoPage, key: `photo-${row.id}` },
      h(Text, { style: styles.photoHeading }, "ATTENDANCE PHOTOS"),
      h(Text, { style: styles.photoMeta }, `${worker?.display_name || "Worker"} · ${String(row.check_in_time).slice(0, 10)} · ${getSessionSnapshot(row).projectName}`),
      h(View, { style: styles.photoRow },
        h(View, { style: styles.photoCard },
          checkInUrl ? h(Image, { style: styles.photo, src: checkInUrl }) : h(View, { style: styles.photo }),
          h(Text, { style: styles.photoLabel }, "CHECK IN"), h(Text, { style: styles.photoCode }, checkInEvent?.record_code || "-")),
        h(View, { style: styles.photoCard },
          checkOutUrl ? h(Image, { style: styles.photo, src: checkOutUrl }) : h(View, { style: styles.photo }),
          h(Text, { style: styles.photoLabel }, "CHECK OUT"), h(Text, { style: styles.photoCode }, checkOutEvent?.record_code || "-"))),
      h(View,{style:styles.footer,fixed:true},h(Text,null,"Generated by OnSite"),h(Text,{render:({pageNumber,totalPages})=>`${pageNumber} / ${totalPages}`}))));
    const doc = h(Document, null,
      h(Page, { size: "A4", style: styles.page },
        h(Text, { style: styles.brand }, report.companyName),
        h(Text, { style: styles.title }, "SITE ATTENDANCE REPORT"), h(View, { style: styles.rule }),
        h(View, { style: styles.metadata },
          h(View, { style: styles.metaBlock }, h(Text,{style:styles.label},"Customer"),h(Text,{style:styles.value},project.customerName),h(Text,{style:styles.label},"Project"),h(Text,{style:styles.value},project.projectName)),
          h(View, { style: styles.metaBlock }, h(Text,{style:styles.label},"Site"),h(Text,{style:styles.value},project.siteName),h(Text,{style:styles.label},"Address"),h(Text,{style:styles.value},project.address),h(Text,{style:styles.label},"Project reference coordinates"),h(Text,{style:styles.value},projectCoordinates || "-"),h(Text,{style:styles.label},"Reporting period"),h(Text,{style:styles.value},`${body.start || "All"} - ${body.end || "All"}`))),
        projectMapUrl ? h(View, { style: styles.projectMapFrame }, h(Image, { style: styles.projectMap, src: projectMapUrl }), projectCoordinates ? h(Text, { style: styles.coordinateBadge }, projectCoordinates) : null) : null,
        h(Text,{style:styles.section},"SUMMARY"),
        h(View,{style:styles.stats},
          ...[["Personnel",report.summary.total_personnel],["Sessions",report.summary.total_work_sessions],["Work hours",report.summary.total_work_hours],["Incomplete",report.summary.incomplete_sessions]].map(([label,value]) => h(View,{style:styles.stat,key:String(label)},h(Text,{style:styles.label},String(label)),h(Text,{style:styles.statValue},String(value))))),
        h(Text,{style:styles.section},"PERSONNEL SUMMARY"),
        h(View,{style:styles.table},
          h(View,{style:[styles.row,styles.header]},h(Text,{style:styles.pWorker},"Worker"),h(Text,{style:styles.pCompany},"Company"),h(Text,{style:styles.pDays},"Days"),h(Text,{style:styles.pHours},"Hours")),
          ...personnelRows),
        h(Text,{style:styles.section},"DAILY ATTENDANCE"),
        h(View,{style:styles.table},
          h(View,{style:[styles.row,styles.header]},h(Text,{style:styles.cDate},"Date"),h(Text,{style:styles.cWorker},"Worker"),h(Text,{style:styles.cTime},"In"),h(Text,{style:styles.cTime},"Out"),h(Text,{style:styles.cHours},"Hours"),h(Text,{style:styles.cStatus},"Status")),
          ...tableRows),
        summaryRows.length ? h(React.Fragment, null,
          h(Text,{style:styles.section},"DAILY WORK SUMMARIES"),
          h(View,{style:styles.table},
            h(View,{style:[styles.row,styles.header]},h(Text,{style:styles.summaryDate},"Date"),h(Text,{style:styles.summaryWorker},"Worker"),h(Text,{style:styles.summaryText},"Today's work summary")),
            ...summaryRows)) : null,
        body.include_photos && report.sessions.length > 60 ? h(Text,{style:styles.label},"Photo appendix is limited to the first 60 sessions in this report.") : null,
        h(View,{style:styles.footer,fixed:true},h(Text,null,"Generated by OnSite"),h(Text,{render:({pageNumber,totalPages})=>`${pageNumber} / ${totalPages}`}))),
      ...photoPages);
    const buffer = await renderToBuffer(doc);
    return new Response(new Uint8Array(buffer), { headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=onsite-attendance-report.pdf", "cache-control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
