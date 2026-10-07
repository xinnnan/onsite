import { safeTimeZone, toZonedDateTimeLocalInput, zonedDateTimeToUtc } from "./timezones.ts";

// Mirrors create_manual_attendance: sessions longer than 18 hours are LONG_SESSION.
export const LONG_SESSION_SECONDS = 18 * 60 * 60;

export type TimesheetProject = { id: string; timezone?: string | null };

export type TimesheetSessionInput = {
  id: string;
  project_id: string;
  project_name: string;
  site_name: string;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
  is_manual_entry: boolean;
  timezone: string;
};

export type TimesheetRow = {
  key: string;
  sessionId: string | null;
  date: string;
  projectId: string;
  projectName: string;
  siteName: string;
  checkIn: string;
  checkOut: string;
  timeZone: string;
  status: string | null;
  isManualEntry: boolean;
  locked: boolean;
  original: { projectId: string; checkIn: string; checkOut: string; checkInUtc: string; checkOutUtc: string | null } | null;
};

export type TimesheetIssueCode =
  | "BOTH_TIMES_REQUIRED"
  | "CHECK_IN_REQUIRED"
  | "DELETE_ON_RECORD_PAGE"
  | "INVALID_TIME"
  | "SAME_TIME"
  | "PROJECT_REQUIRED"
  | "OVERLAP";

export type TimesheetIssue = { code: TimesheetIssueCode; conflictDate?: string };

export type TimesheetSaveRequest = {
  key: string;
  method: "POST" | "PATCH";
  url: string;
  body: Record<string, unknown>;
};

type TimeField = "checkIn" | "checkOut";
type Interval = { start: number; end: number | null };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateToUtcMillis(date: string) {
  const match = DATE_PATTERN.exec(date);
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function millisToDate(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const millis = dateToUtcMillis(date);
  return millis == null ? date : millisToDate(millis + days * 86_400_000);
}

export function isWeekend(date: string) {
  const millis = dateToUtcMillis(date);
  if (millis == null) return false;
  const day = new Date(millis).getUTCDay();
  return day === 0 || day === 6;
}

/** Accepts spreadsheet-style input ("8", "830", "17:30", "5:30pm") and returns "HH:MM", "" for blank, or null when unreadable. */
export function normalizeTimeInput(value: string): string | null {
  const text = value.trim().toLowerCase().replace(/\s+/g, "");
  if (!text) return "";
  const match = /^(\d{1,2})(?:[:.]?(\d{2}))?(a|p|am|pm)?$/.exec(text);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const suffix = match[3];
  if (minute > 59) return null;
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (suffix.startsWith("p") ? 12 : 0);
  }
  if (hour > 23) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

export function listDates(start: string, end: string) {
  const first = dateToUtcMillis(start);
  const last = dateToUtcMillis(end);
  if (first == null || last == null || first > last) return [];
  const dates: string[] = [];
  for (let millis = first; millis <= last; millis += 86_400_000) dates.push(millisToDate(millis));
  return dates;
}

/** Out times at or before the in time belong to the next day. */
export function resolveCheckOut(date: string, checkIn: string, checkOut: string) {
  if (!checkOut) return null;
  return `${checkOut <= checkIn ? addDays(date, 1) : date}T${checkOut}`;
}

function blankRow(date: string, projectId: string, index: number): TimesheetRow {
  return {
    key: `new:${date}:${index}`,
    sessionId: null,
    date,
    projectId,
    projectName: "",
    siteName: "",
    checkIn: "",
    checkOut: "",
    timeZone: "",
    status: null,
    isManualEntry: false,
    locked: false,
    original: null,
  };
}

function sessionRow(session: TimesheetSessionInput): TimesheetRow | null {
  const timeZone = safeTimeZone(session.timezone);
  const checkInLocal = toZonedDateTimeLocalInput(session.check_in_time, timeZone);
  if (!checkInLocal) return null;
  const checkOutLocal = toZonedDateTimeLocalInput(session.check_out_time, timeZone);
  const date = checkInLocal.slice(0, 10);
  const checkIn = checkInLocal.slice(11);
  const checkOut = checkOutLocal.slice(11);
  return {
    key: session.id,
    sessionId: session.id,
    date,
    projectId: session.project_id,
    projectName: session.project_name,
    siteName: session.site_name,
    checkIn,
    checkOut,
    timeZone,
    status: session.status,
    isManualEntry: session.is_manual_entry,
    // The grid only expresses same-day or next-day check-outs; longer spans are edited on the record page.
    locked: Boolean(checkOutLocal) && resolveCheckOut(date, checkIn, checkOut) !== checkOutLocal,
    original: { projectId: session.project_id, checkIn, checkOut, checkInUtc: session.check_in_time, checkOutUtc: session.check_out_time },
  };
}

export function buildTimesheetRows({ start, end, sessions, defaultProjectId }: {
  start: string;
  end: string;
  sessions: TimesheetSessionInput[];
  defaultProjectId: string;
}) {
  const byDate = new Map<string, TimesheetRow[]>();
  const ordered = [...sessions].sort((a, b) => Date.parse(a.check_in_time) - Date.parse(b.check_in_time));
  for (const session of ordered) {
    const row = sessionRow(session);
    if (!row) continue;
    byDate.set(row.date, [...(byDate.get(row.date) || []), row]);
  }
  return listDates(start, end).flatMap((date) => byDate.get(date) || [blankRow(date, defaultProjectId, 0)]);
}

function projectTimeZone(projects: TimesheetProject[], projectId: string) {
  return projects.find((project) => project.id === projectId)?.timezone || null;
}

/** Existing records keep their snapshot time zone unless the project changes, matching the correction API. */
export function rowTimeZone(row: TimesheetRow, projects: TimesheetProject[]) {
  if (row.original && row.projectId === row.original.projectId) return row.timeZone;
  return safeTimeZone(projectTimeZone(projects, row.projectId) || row.timeZone);
}

function typedInterval(row: TimesheetRow, projects: TimesheetProject[]): Interval | null {
  const checkIn = normalizeTimeInput(row.checkIn);
  const checkOut = normalizeTimeInput(row.checkOut);
  if (!checkIn || checkOut === null) return null;
  const timeZone = rowTimeZone(row, projects);
  const start = zonedDateTimeToUtc(`${row.date}T${checkIn}`, timeZone);
  if (!start) return null;
  if (!checkOut) return { start: start.valueOf(), end: null };
  const end = zonedDateTimeToUtc(resolveCheckOut(row.date, checkIn, checkOut)!, timeZone);
  return end ? { start: start.valueOf(), end: end.valueOf() } : null;
}

export function rowDurationSeconds(row: TimesheetRow, projects: TimesheetProject[]) {
  const interval = typedInterval(row, projects);
  return interval?.end == null ? null : Math.round((interval.end - interval.start) / 1000);
}

function sameTime(value: string, original: string) {
  return (normalizeTimeInput(value) ?? value) === original;
}

export function isRowDirty(row: TimesheetRow) {
  if (!row.original) return Boolean(row.checkIn.trim() || row.checkOut.trim());
  return row.projectId !== row.original.projectId
    || !sameTime(row.checkIn, row.original.checkIn)
    || !sameTime(row.checkOut, row.original.checkOut);
}

function fieldIssue(row: TimesheetRow, projects: TimesheetProject[]): TimesheetIssue | null {
  const checkIn = normalizeTimeInput(row.checkIn);
  const checkOut = normalizeTimeInput(row.checkOut);
  if (row.original) {
    if (checkIn === "" && checkOut === "") return { code: "DELETE_ON_RECORD_PAGE" };
    if (checkIn === "") return { code: "CHECK_IN_REQUIRED" };
  }
  if (checkIn === null || checkOut === null) return { code: "INVALID_TIME" };
  if (!row.original) {
    if (!checkIn || !checkOut) return { code: "BOTH_TIMES_REQUIRED" };
    if (!projects.some((project) => project.id === row.projectId)) return { code: "PROJECT_REQUIRED" };
  }
  if (checkIn === checkOut) return { code: "SAME_TIME" };
  if (!typedInterval(row, projects)) return { code: "INVALID_TIME" };
  return null;
}

function intervalsOverlap(row: TimesheetRow, own: Interval, other: Interval) {
  if (other.end === null) {
    // The manual-entry RPC treats a record without check-out as open-ended, so new rows after it are rejected.
    if (!row.original) return own.end === null || own.end > other.start;
    return own.start <= other.start && (own.end === null ? own.start === other.start : other.start < own.end);
  }
  if (own.end === null) return other.start <= own.start && own.start < other.end;
  return own.start < other.end && other.start < own.end;
}

export function validateTimesheetRows(rows: TimesheetRow[], projects: TimesheetProject[]) {
  const issues: Record<string, TimesheetIssue> = {};
  const intervals = new Map<string, Interval>();
  const dirtyKeys = new Set<string>();
  for (const row of rows) {
    if (isRowDirty(row)) {
      dirtyKeys.add(row.key);
      const issue = fieldIssue(row, projects);
      if (issue) issues[row.key] = issue;
      else intervals.set(row.key, typedInterval(row, projects)!);
    } else if (row.original) {
      const start = Date.parse(row.original.checkInUtc);
      const end = row.original.checkOutUtc ? Date.parse(row.original.checkOutUtc) : null;
      if (Number.isFinite(start)) intervals.set(row.key, { start, end: end !== null && Number.isFinite(end) ? end : null });
    }
  }
  for (const row of rows) {
    const own = intervals.get(row.key);
    if (!dirtyKeys.has(row.key) || !own) continue;
    const conflict = rows.find((other) => {
      const otherInterval = other.key === row.key ? null : intervals.get(other.key);
      return otherInterval ? intervalsOverlap(row, own, otherInterval) : false;
    });
    if (conflict) issues[row.key] = { code: "OVERLAP", conflictDate: conflict.date };
  }
  return issues;
}

export function buildSaveRequests(rows: TimesheetRow[], projects: TimesheetProject[], { workerId, reason }: { workerId: string; reason: string }) {
  const issues = validateTimesheetRows(rows, projects);
  return rows
    .filter((row) => !row.locked && isRowDirty(row) && !issues[row.key])
    .sort((a, b) => a.date.localeCompare(b.date) || Number(!a.original) - Number(!b.original))
    .map((row): TimesheetSaveRequest => {
      const checkIn = normalizeTimeInput(row.checkIn)!;
      const checkOut = normalizeTimeInput(row.checkOut)!;
      const checkInTime = `${row.date}T${checkIn}`;
      const checkOutTime = resolveCheckOut(row.date, checkIn, checkOut);
      if (!row.original || !row.sessionId) {
        return {
          key: row.key,
          method: "POST",
          url: "/api/admin/attendance/manual",
          body: { user_id: workerId, project_id: row.projectId, check_in_time: checkInTime, check_out_time: checkOutTime, admin_note: reason },
        };
      }
      const duration = rowDurationSeconds(row, projects);
      const status = checkOutTime
        ? (duration != null && duration > LONG_SESSION_SECONDS ? "LONG_SESSION" : "MANUALLY_CORRECTED")
        : (row.status === "OPEN" ? "OPEN" : "MISSING_CHECKOUT");
      return {
        key: row.key,
        method: "PATCH",
        url: `/api/admin/work-sessions/${row.sessionId}`,
        body: {
          ...(row.projectId !== row.original.projectId ? { project_id: row.projectId } : {}),
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
          status,
          reason,
        },
      };
    });
}

export function fillBlankRows(rows: TimesheetRow[], { projectId, checkIn, checkOut, weekdaysOnly }: {
  projectId: string;
  checkIn: string;
  checkOut: string;
  weekdaysOnly: boolean;
}) {
  return rows.map((row) => {
    const untouched = !row.original && !row.checkIn.trim() && !row.checkOut.trim();
    if (!untouched || (weekdaysOnly && isWeekend(row.date))) return row;
    return { ...row, projectId: projectId || row.projectId, checkIn, checkOut };
  });
}

export function addShiftRow(rows: TimesheetRow[], date: string, projectId: string) {
  const lastIndex = rows.findLastIndex((row) => row.date === date);
  if (lastIndex < 0) return rows;
  const keys = new Set(rows.map((row) => row.key));
  let index = rows.filter((row) => row.date === date).length;
  while (keys.has(`new:${date}:${index}`)) index += 1;
  return [...rows.slice(0, lastIndex + 1), blankRow(date, projectId, index), ...rows.slice(lastIndex + 1)];
}

/** Removes an unsaved row; a day's only row is cleared instead so every day stays visible. */
export function removeShiftRow(rows: TimesheetRow[], key: string, defaultProjectId: string) {
  const target = rows.find((row) => row.key === key);
  if (!target || target.original) return rows;
  if (rows.filter((row) => row.date === target.date).length > 1) return rows.filter((row) => row.key !== key);
  return rows.map((row) => (row.key === key ? { ...row, projectId: defaultProjectId, checkIn: "", checkOut: "" } : row));
}

/** Pastes a tab/newline grid copied from a spreadsheet down the In/Out columns. */
export function applyPastedTimes(rows: TimesheetRow[], startKey: string, column: TimeField, text: string) {
  const start = rows.findIndex((row) => row.key === startKey);
  if (start < 0) return rows;
  const fields: TimeField[] = column === "checkIn" ? ["checkIn", "checkOut"] : ["checkOut"];
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
  const next = [...rows];
  let target = start;
  for (const line of lines) {
    while (target < next.length && next[target].locked) target += 1;
    if (target >= next.length) break;
    const cells = line.split("\t");
    const updated = { ...next[target] };
    fields.forEach((field, index) => {
      const raw = (cells[index] || "").trim();
      if (raw) updated[field] = normalizeTimeInput(raw) || raw;
    });
    next[target] = updated;
    target += 1;
  }
  return next;
}

/** Re-applies drafts that failed to save onto rows freshly loaded from the server. */
export function mergeFailedDrafts(fresh: TimesheetRow[], drafts: TimesheetRow[]) {
  const rows = [...fresh];
  for (const draft of drafts) {
    const edits = { projectId: draft.projectId, checkIn: draft.checkIn, checkOut: draft.checkOut };
    const index = rows.findIndex((row) => row.key === draft.key);
    if (index >= 0) {
      rows[index] = { ...rows[index], ...edits };
      continue;
    }
    if (draft.original) continue;
    const lastIndex = rows.findLastIndex((row) => row.date === draft.date);
    if (lastIndex >= 0) rows.splice(lastIndex + 1, 0, draft);
  }
  return rows;
}
