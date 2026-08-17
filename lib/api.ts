import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message || code);
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    const message = process.env.NODE_ENV === "production" ? error.code : error.message;
    return NextResponse.json({ error: error.code, message }, { status: error.status });
  }
  console.error("OnSite API error", error);
  const message = process.env.NODE_ENV === "production" ? "INTERNAL_ERROR" : error instanceof Error ? error.message : "INTERNAL_ERROR";
  return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
}

export function assertFound<T>(value: T | null | undefined, code = "NOT_FOUND"): T {
  if (value == null) throw new ApiError(404, code);
  return value;
}
