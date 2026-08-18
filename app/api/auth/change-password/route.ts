import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { usernameToInternalEmail } from "@/lib/auth";
import { changePasswordSchema, parseBody } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { profile, supabase, demo } = await requireAuth();
    const body = parseBody(changePasswordSchema, await request.json());

    if (demo) return NextResponse.json({ ok: true });
    if (!supabase) throw new ApiError(503, "SUPABASE_NOT_CONFIGURED");

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: usernameToInternalEmail(profile.username),
      password: body.current_password,
    });
    if (verifyError) throw new ApiError(400, "INVALID_CURRENT_PASSWORD");

    const { error: updateError } = await supabase.auth.updateUser({
      password: body.new_password,
    });
    if (updateError) throw new ApiError(400, "PASSWORD_UPDATE_FAILED");

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.name === "VALIDATION_ERROR") {
      const code = error.message.includes("PASSWORD_CONFIRMATION_MISMATCH")
        ? "PASSWORD_CONFIRMATION_MISMATCH"
        : error.message.includes("NEW_PASSWORD_MUST_BE_DIFFERENT")
          ? "NEW_PASSWORD_MUST_BE_DIFFERENT"
          : "INVALID_PASSWORD_INPUT";
      return apiErrorResponse(new ApiError(400, code));
    }
    return apiErrorResponse(error);
  }
}
