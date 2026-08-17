import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";

export async function GET() {
  try {
    const { supabase, profile, demo } = await requireAuth("WORKER");
    if (demo || !supabase) return NextResponse.json({ session: null, demo: true });
    const { data, error } = await supabase.from("work_sessions")
      .select("*, project:projects(id,project_name,customer_name,site_name,address_line_1,city,state,postal_code,timezone)")
      .eq("user_id", profile.id).eq("status", "OPEN").maybeSingle();
    if (error) throw error;
    return NextResponse.json({ session: data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
