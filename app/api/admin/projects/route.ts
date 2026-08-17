import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseBody, projectSchema } from "@/lib/validation";

export async function GET() {
  try {
    const { demo } = await requireAuth("ADMIN");
    if (demo) return NextResponse.json({ projects: [], demo: true });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("projects").select("*, project_assignments(id,status,user:profiles(id,display_name,status))").order("project_name");
    if (error) throw error;
    const projects = await Promise.all((data || []).map(async (project) => {
      if (!project.map_image_path) return { ...project, map_url: null };
      const signed = await admin.storage.from("project-assets").createSignedUrl(project.map_image_path, 600);
      return { ...project, map_url: signed.data?.signedUrl || null };
    }));
    return NextResponse.json({ projects });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { profile: adminProfile, demo } = await requireAuth("ADMIN");
    const body = parseBody(projectSchema, await request.json());
    if (demo) return NextResponse.json({ project: { id: crypto.randomUUID(), ...body }, demo: true }, { status: 201 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("projects").insert(body).select().single();
    if (error || !data) throw new ApiError(409, "PROJECT_CREATE_FAILED", error?.message);
    await writeAuditLog({ adminUserId: adminProfile.id, action: "PROJECT_CREATED", entityType: "PROJECT", entityId: data.id, newValue: data, reason: "Administrator created project" });
    return NextResponse.json({ project: data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "VALIDATION_ERROR") return apiErrorResponse(new ApiError(400, "VALIDATION_ERROR", error.message));
    return apiErrorResponse(error);
  }
}
