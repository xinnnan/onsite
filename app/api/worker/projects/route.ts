import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";

const demoProjects = [
  { id: "adidas", project_code: "ADI-AMR-26", project_name: "adidas Indy AMR", customer_name: "adidas", city: "Indianapolis", state: "IN", status: "ACTIVE" },
  { id: "walmart", project_code: "WMT-ATL-04", project_name: "Walmart Atlanta", customer_name: "Walmart", city: "Norcross", state: "GA", status: "ACTIVE" },
];

export async function GET() {
  try {
    const { supabase, profile, demo } = await requireAuth("WORKER");
    if (demo || !supabase) return NextResponse.json({ projects: demoProjects, demo: true });
    const { data, error } = await supabase.from("project_assignments")
      .select("project:projects(id,project_code,project_name,customer_name,site_name,address_line_1,address_line_2,city,state,postal_code,country,timezone,status)")
      .eq("user_id", profile.id).eq("status", "ACTIVE");
    if (error) throw error;
    return NextResponse.json({ projects: data?.map((row) => row.project).filter(Boolean) ?? [] });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
