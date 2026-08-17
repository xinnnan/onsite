import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse, assertFound } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseBody, projectUpdateSchema } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { demo } = await requireAuth("ADMIN");
    const { id } = await params;
    if (demo) return NextResponse.json({ project: null, demo: true });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("projects").select("*, project_assignments(*,user:profiles(id,username,display_name,company,worker_type,status))").eq("id", id).single();
    if (error || !data) throw new ApiError(404, "PROJECT_NOT_FOUND");
    let map_url: string | null = null;
    if (data.map_image_path) {
      const signed = await admin.storage.from("project-assets").createSignedUrl(data.map_image_path, 600);
      map_url = signed.data?.signedUrl || null;
    }
    return NextResponse.json({ project: { ...data, map_url } });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile: adminProfile, demo } = await requireAuth("ADMIN");
    const { id } = await params;
    const body = parseBody(projectUpdateSchema, await request.json());
    if (demo) return NextResponse.json({ project: { id, ...body }, demo: true });
    const admin = createSupabaseAdminClient();
    const { data: oldValue } = await admin.from("projects").select("*").eq("id", id).single();
    assertFound(oldValue, "PROJECT_NOT_FOUND");
    const { data, error } = await admin.from("projects").update(body).eq("id", id).select().single();
    if (error || !data) throw new ApiError(409, "PROJECT_UPDATE_FAILED", error?.message);
    await writeAuditLog({ adminUserId: adminProfile.id, action: "PROJECT_UPDATED", entityType: "PROJECT", entityId: id, oldValue, newValue: data, reason: "Administrator updated project" });
    return NextResponse.json({ project: data });
  } catch (error) {
    if (error instanceof Error && error.name === "VALIDATION_ERROR") return apiErrorResponse(new ApiError(400, "VALIDATION_ERROR", error.message));
    return apiErrorResponse(error);
  }
}
