# All-projects report + Attendance timesheet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let admins export a customer report across all projects for a worker/timeframe, and verify/fill one person's attendance in a spreadsheet-style Timesheet tab.

**Architecture:** Pure, unit-tested logic lives in `lib/report-projects.ts` and `lib/timesheet.ts`. Report routes reuse `buildReportData()` with an optional project. The Timesheet tab is a client view in `AdminShell.tsx` that saves each changed row through the existing audited endpoints (`POST /api/admin/attendance/manual`, `PATCH /api/admin/work-sessions/:id`).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, @react-pdf/renderer, ExcelJS, `node --test` (native TS type stripping on Node 26).

Design: `docs/plans/2026-10-07-all-projects-report-and-timesheet-design.md`

---

### Task 1: Unit-test harness

**Files:** Modify `tsconfig.json`, `package.json`; Create `tests/` folder.

1. Add `"allowImportingTsExtensions": true` to `compilerOptions` (valid because `noEmit: true`) so pure modules can `import ... from "./timezones.ts"` and run under Node without a bundler.
2. Add script `"test:unit": "node --test tests/"`; change `"test"` to `"npm run test:unit && npm run build"`.
3. Run `npm run test:unit` → expect "0 tests" (no failures).

### Task 2: Project roster aggregation (`lib/report-projects.ts`)

**Test first** — `tests/report-projects.test.ts`:
- groups sessions by `projectId`, counting distinct local dates, sessions, and hours rounded to 2 dp;
- first-seen snapshot names win (sessions arrive newest first);
- output sorted by customer then project name;
- empty input → `[]`.

Run `npm run test:unit` → FAIL (module missing). Implement `summarizeReportProjects(items)`. Run → PASS. Commit.

### Task 3: Timesheet logic (`lib/timesheet.ts`)

**Test first** — `tests/timesheet.test.ts`, one `describe` per function:
- `normalizeTimeInput`: `"8"→"08:00"`, `"830"→"08:30"`, `"1730"→"17:30"`, `"5:30pm"→"17:30"`, `"12am"→"00:00"`, `""→""`, `"25:00"→null`, `"abc"→null`.
- `listDates(start,end)`: inclusive, crosses month/leap-day, reversed → `[]`.
- `resolveCheckOut(date,in,out)`: same day when out > in; next day (+1) when out ≤ in; empty out → `null`.
- `buildTimesheetRows`: blank row per empty day with default project; one row per session sorted by time on busy days; session times converted to the session's time zone; rows whose real span cannot be expressed as same-day/+1 are `locked`.
- `isRowDirty`: blank new row is clean; typed new row is dirty; existing row dirty only when project/in/out differ from original.
- `validateTimesheetRows`: `BOTH_TIMES_REQUIRED`, `CHECK_IN_REQUIRED`, `DELETE_ON_RECORD_PAGE`, `INVALID_TIME`, `SAME_TIME`, `OVERLAP` (incl. overlap with an existing open-ended record for new rows, across projects/time zones).
- `buildSaveRequests`: POST manual for new rows (`admin_note` = reason); PATCH for edits with `MANUALLY_CORRECTED` / `LONG_SESSION` (>18 h) / `MISSING_CHECKOUT` (out cleared) / `OPEN` (out still empty on an open session); `project_id` only when changed; chronological order, edits before creates on the same day.
- `fillBlankRows`: fills only untouched new rows, weekdays only when asked.
- `addShiftRow`: inserts a unique new row after the day's last row.
- `applyPastedTimes`: tab/newline grid fills In/Out down from the start row, skipping locked rows; blank cells leave values unchanged.
- `mergeFailedDrafts`: failed drafts re-applied onto freshly loaded rows.

Run → FAIL. Implement. Run → PASS. Commit.

### Task 4: All-projects report data + preview API

**Files:** `lib/report-data.ts`, `app/api/admin/reports/preview/route.ts`.
- `buildReportData` returns `projects: summarizeReportProjects(...)`.
- Preview: remove `PROJECT_REQUIRED`; when no `project_id` return `all_projects: true`, `project: null`, `projects`; each session gains `project_name`, `site_name`. Demo preview mirrors this.

### Task 5: PDF / XLSX all-projects output

**Files:** `app/api/admin/reports/pdf/route.ts`, `app/api/admin/reports/xlsx/route.ts`.
- PDF all-projects header: Personnel + Reporting period + Customers; "PROJECTS COVERED" table; Project column in DAILY ATTENDANCE and DAILY WORK SUMMARIES; no single map. Filename site part = `All-Projects`.
- XLSX Summary sheet: "Projects" block (Customer, Project, Site, Time Zone, Days, Sessions, Hours).
- CSV unchanged.

### Task 6: Reports UI

**Files:** `app/admin/AdminShell.tsx` (`ReportsView`, text tables), `app/globals.css`.
- "All projects" option (sentinel `all`) first in the Project select; body omits `project_id` in that mode.
- Preview: header shows "All projects"; "Projects covered" roster table; Project column in daily table (CSS grid variant `.report-table.attendance.with-project`).

### Task 7: Timesheet route + tabs

**Files:** Create `app/admin/attendance/timesheet/page.tsx`; modify `AdminShell.tsx`, `app/api/admin/attendance/route.ts` (add `site_name` to projects select), `app/api/admin/project-assignments/route.ts` (add `customer_name,site_name,timezone` to projects select).
- New view `attendance-timesheet`; nav highlights Attendance; shell endpoint `/api/admin/project-assignments?active_only=true`.
- `AttendanceTabs` (Records | Timesheet) rendered atop both views.

### Task 8: Timesheet grid UI

**Files:** `AdminShell.tsx` (`TimesheetView` + 4-language copy), `app/globals.css`.
- Toolbar: worker, start, end, Load. Second bar: default project, fill In/Out, "Fill blank weekdays", weekend toggle.
- Grid columns: Date (weekday) | Project / Site | In | Out (+1 badge) | Hours | Entry type/status | actions (+ shift, remove unsaved shift, open record).
- Enter → next row same column; paste grid; normalize on blur; dirty rows highlighted; issues shown inline; footer totals.
- Save bar: count, reason (prefilled), sequential save with progress; reload + `mergeFailedDrafts`; toast summary; `beforeunload` + confirm on reload/tab switch when dirty.

### Task 9: Verification

- `npm run test:unit`, `npm run lint`, `npm run build`.
- Browser (demo mode, `npm run dev`): Reports → All projects preview; Attendance → Timesheet: load, type, paste, fill, save path (demo endpoints), mobile width.
- Update `docs/prd-status.md` with the two features. Commit.
