import { localDateKey } from "./timezones.ts";

/** A work session as the attendance rules see it; a missing check-out means it is still open. */
export type SessionSpan = { id?: string; check_in_time: string; check_out_time?: string | null; status?: string | null };

/**
 * People clock in once a day: whether any session already started on today's date in the project's
 * time zone. Voided sessions do not count.
 */
export function checkedInToday(sessions: readonly SessionSpan[], now: Date, timeZone: string) {
  const today = localDateKey(now, timeZone);
  return sessions.some((session) => session.status !== "VOID" && localDateKey(session.check_in_time, timeZone) === today);
}

/**
 * The first session whose time overlaps [start, end); an open session, or a missing end, runs on
 * indefinitely. Sessions that only touch (one ends as the next starts) do not overlap, as in
 * create_manual_attendance.
 */
export function overlappingSession<Session extends SessionSpan>(span: { start: Date; end: Date | null }, sessions: readonly Session[]) {
  const start = span.start.valueOf();
  const end = span.end ? span.end.valueOf() : Infinity;
  return sessions.find((session) => {
    if (session.status === "VOID") return false;
    const otherStart = Date.parse(session.check_in_time);
    const otherEnd = session.check_out_time ? Date.parse(session.check_out_time) : Infinity;
    return start < otherEnd && otherStart < end;
  }) ?? null;
}
