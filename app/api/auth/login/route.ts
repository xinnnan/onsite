import { NextResponse } from "next/server";
import { usernameToInternalEmail } from "@/lib/auth";
import { createSupabaseServerClient, isDemoMode, isSupabaseConfigured } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; password?: string };
    if (!body.username || !body.password) return NextResponse.json({ error: "MISSING_CREDENTIALS" }, { status: 400 });
    const email = usernameToInternalEmail(body.username);

    if (!isSupabaseConfigured()) {
      if (!isDemoMode()) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
      const role = body.username.toLowerCase().startsWith("admin") ? "ADMIN" : "WORKER";
      const response = NextResponse.json({ ok: true, role, demo: true });
      response.cookies.set("onsite-demo-role", role, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 8 });
      return response;
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: body.password });
    if (error || !data.user) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role,status").eq("auth_user_id", data.user.id).single();
    if (!profile || profile.status !== "ACTIVE") {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "ACCOUNT_INACTIVE" }, { status: 403 });
    }
    return NextResponse.json({ ok: true, role: profile.role });
  } catch (error) {
    const code = error instanceof Error ? error.message : "LOGIN_FAILED";
    return NextResponse.json({ error: code }, { status: code === "INVALID_USERNAME" ? 400 : 500 });
  }
}
