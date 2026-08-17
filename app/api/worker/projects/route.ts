import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const demoProjects = [
  { id: "adidas", project_code: "ADI-AMR-26", project_name: "adidas Indy AMR", customer_name: "adidas", city: "Indianapolis", state: "IN", status: "ACTIVE" },
  { id: "walmart", project_code: "WMT-ATL-04", project_name: "Walmart Atlanta", customer_name: "Walmart", city: "Norcross", state: "GA", status: "ACTIVE" },
];

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ projects: demoProjects, demo: true });
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { data, error } = await supabase.from("project_assignments").select("project:projects(id,project_code,project_name,customer_name,city,state,status)").eq("status", "ACTIVE");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data?.map((row) => row.project) ?? [] });
}
