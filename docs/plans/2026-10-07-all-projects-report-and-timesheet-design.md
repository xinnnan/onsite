# All-projects report + Attendance timesheet — design

Date: 2026-10-07

## Feature 1 — "All projects" customer report

Workers can work on several projects in one period, so the report builder must be able to export one worker (or all personnel) across every project.

- **UI** (`ReportsView`): the Project select gains an **All projects** option (empty value). The worker select is unchanged. In all-projects mode the preview header reads "All projects", shows a **Projects covered** roster (customer, project, site, address, time zone, days, hours), and the daily attendance table gains a **Project** column. Single-project reports keep today's layout.
- **Data** (`lib/report-data.ts`): `buildReportData()` additionally returns `projects`, a roster grouped by each session's snapshot (historical names win over current master data). Aggregation lives in the pure module `lib/report-projects.ts`.
- **Preview API**: drop `PROJECT_REQUIRED`; return `all_projects: true`, `project: null`, `projects`, and `project_name` per session.
- **PDF**: all-projects header = worker + period + roster table, no map. Daily attendance and work-summary tables gain a Project column; times stay in each session's project-local time zone. Filename `All-Projects_<dates>_<worker>.pdf`.
- **XLSX**: Summary sheet gains a "Projects" block. **CSV**: unchanged (already per-row project columns).

## Feature 2 — Attendance → Timesheet tab

A spreadsheet-style editor to verify and fill one person's attendance quickly.

- **Route**: `/admin/attendance/timesheet` (`view="attendance-timesheet"`). The Attendance page gets two tabs: **Records** and **Timesheet**.
- **Controls**: worker, start date, end date (any range, no cap), default project for new entries (defaults to the worker's most recent project in range, else the first active project).
- **Grid**: one row per calendar day in range. Days with several sessions show one row per session; empty days show one blank row.
  Columns: **Date (weekday)** | **Project / Site** | **In** | **Out** | **Hours** | **Entry type** | actions (**+** add shift that day, open record).
  In/Out are `HH:MM` in the row's project-local time zone. Out ≤ In means the next day and shows **+1**.
- **Speed**: Enter moves to the same column on the next row. **Fill blank weekdays** fills empty rows with a default In/Out (e.g. 08:00–17:00) and default project; nothing is saved until Save.
- **Validation (client)**: new rows need both In and Out; In cannot be cleared on an existing record; clearing both on an existing record is not allowed (delete stays on the record detail page); clearing only Out on an existing record → `MISSING_CHECKOUT`; overlapping rows (across all projects) are flagged.
- **Manual verified entries**: new rows are created through `POST /api/admin/attendance/manual` (`is_manual_entry = true`, admin-created, `MANUALLY_CORRECTED`, or `LONG_SESSION` over 18 h). Edited rows go through `PATCH /api/admin/work-sessions/:id` with status `MANUALLY_CORRECTED` (`LONG_SESSION` over 18 h, `MISSING_CHECKOUT` when Out is cleared).
- **Save**: changed rows are highlighted; **Save changes** asks for one reason (prefilled "Verified manually via timesheet"), used for every row's audit log / admin note. Rows save sequentially with a progress counter; saved rows refresh from the server, failed rows keep their draft and show the error. Unsaved changes trigger a leave warning.
- **Why client orchestration**: reuses the existing audited endpoints, the overlap-checking RPC, and watermark regeneration with no duplicated server write logic. A DB-only batch RPC was rejected because it cannot regenerate photo watermarks (Sharp runs in Node).
- **Pure logic** in `lib/timesheet.ts`: day list, row building, overnight rollover, hours, change detection, validation, overlap detection, request payload building.

## Testing

- Unit tests (`node --test`, native TS type stripping) for `lib/report-projects.ts` and `lib/timesheet.ts`.
- `npm run lint`, `npm run build`, then browser verification of both features.
