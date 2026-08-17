import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { writeAuditLog } from "@/lib/audit";
import { usernameToInternalEmail } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseBody, workerCreateSchema } from "@/lib/validation";

export async function GET() {
  try {
    const { demo } = await requireAuth("ADMIN");
    if (demo) return NextResponse.json({ users: [] , demo: true });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("profiles").select("*, project_assignments(id,status,project:projects(id,project_name,status))").order("display_name");
    if (error) throw error;
    return NextResponse.json({ users: data || [] });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { profile: adminProfile, demo } = await requireAuth("ADMIN");
    const body = parseBody(workerCreateSchema, await request.json());
    if (demo) return NextResponse.json({ user: { id: crypto.randomUUID(), ...body, status: "ACTIVE" }, demo: true }, { status: 201 });
    const admin = createSupabaseAdminClient();
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: usernameToInternalEmail(body.username),
      password: body.password,
      email_confirm: true,
      user_metadata: { username: body.username, display_name: body.display_name },
    });
    if (authError || !authData.user) throw new ApiError(409, "AUTH_USER_CREATE_FAILED", authError?.message);
    const { password: _password, ...profileValues } = body;
    void _password;
    const { data, error } = await admin.from("profiles").insert({ ...profileValues, auth_user_id: authData.user.id, status: "ACTIVE" }).select().single();
    if (error || !data) {
      await admin.auth.admin.deleteUser(authData.user.id);
      throw new ApiError(409, "PROFILE_CREATE_FAILED", error?.message);
    }
    await writeAuditLog({ adminUserId: adminProfile.id, action: "WORKER_CREATED", entityType: "PROFILE", entityId: data.id, newValue: { ...data, auth_user_id: "[REDACTED]" }, reason: "Administrator created account" });
    return NextResponse.json({ user: data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "VALIDATION_ERROR") return apiErrorResponse(new ApiError(400, "VALIDATION_ERROR", error.message));
    return apiErrorResponse(error);
  }
}
