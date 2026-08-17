import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const { demo } = await requireAuth("ADMIN");
    if (demo) return NextResponse.json({ logs: [], demo: true });
    const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 100));
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("audit_logs").select("*,admin:profiles!audit_logs_admin_user_id_fkey(id,display_name,username)").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return NextResponse.json({ logs: data || [] });
  } catch (error) { return apiErrorResponse(error); }
}
