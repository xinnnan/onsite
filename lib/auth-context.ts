import "server-only";
import { cookies } from "next/headers";
import { ApiError } from "@/lib/api";
import { createSupabaseServerClient, isDemoMode, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

export async function requireAuth(requiredRole?: UserRole) {
  const supabase = isSupabaseConfigured() ? await createSupabaseServerClient() : null;

  if (!supabase) {
    if (!isDemoMode()) throw new ApiError(503, "SUPABASE_NOT_CONFIGURED");
    const demoRole = (await cookies()).get("onsite-demo-role")?.value as UserRole | undefined;
    if (!demoRole) throw new ApiError(401, "UNAUTHORIZED");
    if (requiredRole && demoRole !== requiredRole) throw new ApiError(403, "FORBIDDEN");
    const profile: Profile = {
      id: demoRole === "ADMIN" ? "demo-admin" : "demo-worker",
      auth_user_id: demoRole === "ADMIN" ? "demo-admin-auth" : "demo-worker-auth",
      username: demoRole === "ADMIN" ? "admin.demo" : "john01",
      display_name: demoRole === "ADMIN" ? "Alex Lee" : "John Smith",
      company: "DropLetAI",
      worker_type: "EMPLOYEE",
      role: demoRole,
      status: "ACTIVE",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return { user: { id: profile.auth_user_id }, profile, supabase: null, demo: true as const };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new ApiError(401, "UNAUTHORIZED");
  const { data, error } = await supabase.from("profiles").select("*").eq("auth_user_id", user.id).single();
  if (error || !data) throw new ApiError(403, "PROFILE_NOT_FOUND");
  const profile = data as Profile;
  if (profile.status !== "ACTIVE") throw new ApiError(403, "ACCOUNT_INACTIVE");
  if (requiredRole && profile.role !== requiredRole) throw new ApiError(403, "FORBIDDEN");
  return { user, profile, supabase, demo: false as const };
}
