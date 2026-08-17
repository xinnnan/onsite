import sharp from "sharp";
import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse, assertFound } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const MAP_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile: adminProfile, demo } = await requireAuth("ADMIN");
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("map");
    if (!(file instanceof File) || !MAP_TYPES.has(file.type) || file.size === 0 || file.size > 15 * 1024 * 1024) throw new ApiError(400, "INVALID_MAP_IMAGE");
    if (demo) return NextResponse.json({ map_image_path: `${id}/site-map.webp`, demo: true });
    const admin = createSupabaseAdminClient();
    const { data: project } = await admin.from("projects").select("id,map_image_path").eq("id", id).single();
    const targetProject = assertFound(project, "PROJECT_NOT_FOUND");
    let output: Buffer;
    try {
      output = await sharp(Buffer.from(await file.arrayBuffer())).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    } catch {
      throw new ApiError(400, "INVALID_MAP_IMAGE");
    }
    // Versioned paths keep attendance snapshots immutable when an administrator replaces a map.
    const path = `${id}/maps/${crypto.randomUUID()}.webp`;
    const upload = await admin.storage.from("project-assets").upload(path, output, { contentType: "image/webp", upsert: true });
    if (upload.error) throw new ApiError(500, "MAP_UPLOAD_FAILED", upload.error.message);
    const { error } = await admin.from("projects").update({ map_image_path: path }).eq("id", id);
    if (error) {
      await admin.storage.from("project-assets").remove([path]);
      throw new ApiError(500, "MAP_SAVE_FAILED", error.message);
    }
    await writeAuditLog({ adminUserId: adminProfile.id, action: targetProject.map_image_path ? "PROJECT_MAP_REPLACED" : "PROJECT_MAP_UPLOADED", entityType: "PROJECT", entityId: id, oldValue: { map_image_path: targetProject.map_image_path }, newValue: { map_image_path: path }, reason: "Administrator updated project map" });
    return NextResponse.json({ map_image_path: path });
  } catch (error) { return apiErrorResponse(error); }
}
