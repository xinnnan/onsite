create extension if not exists pgcrypto;

create type public.user_role as enum ('WORKER', 'ADMIN');
create type public.profile_status as enum ('ACTIVE', 'DISABLED');
create type public.worker_type as enum ('EMPLOYEE', 'CONTRACTOR', 'SUBCONTRACTOR', 'PARTNER', 'TEMPORARY_WORKER');
create type public.project_status as enum ('ACTIVE', 'COMPLETED', 'ARCHIVED');
create type public.assignment_status as enum ('ACTIVE', 'REMOVED');
create type public.attendance_event_type as enum ('CHECK_IN', 'CHECK_OUT');
create type public.work_session_status as enum ('OPEN', 'COMPLETE', 'MISSING_CHECKOUT', 'LONG_SESSION', 'MANUALLY_CORRECTED', 'VOID');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,40}$'),
  display_name text not null,
  company text,
  worker_type public.worker_type not null default 'EMPLOYEE',
  role public.user_role not null default 'WORKER',
  status public.profile_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(), project_code text not null unique, project_name text not null,
  customer_name text not null, site_name text, address_line_1 text not null, address_line_2 text,
  city text not null, state text, postal_code text, country text not null default 'United States',
  timezone text not null, map_image_path text, start_date date, end_date date,
  status public.project_status not null default 'ACTIVE', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.project_assignments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  project_id uuid not null references public.projects(id), status public.assignment_status not null default 'ACTIVE',
  assigned_at timestamptz not null default now(), removed_at timestamptz,
  unique (user_id, project_id)
);

create table public.attendance_events (
  id uuid primary key default gen_random_uuid(), record_number bigint generated always as identity unique,
  user_id uuid not null references public.profiles(id), project_id uuid not null references public.projects(id),
  event_type public.attendance_event_type not null, server_timestamp timestamptz not null default now(), client_capture_time timestamptz,
  project_name_snapshot text not null, customer_name_snapshot text not null, site_name_snapshot text,
  project_address_snapshot text not null, project_timezone_snapshot text not null, project_map_path_snapshot text,
  original_photo_path text not null, watermarked_photo_path text not null, photo_hash text not null,
  created_at timestamptz not null default now()
);

create table public.work_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), project_id uuid not null references public.projects(id),
  check_in_event_id uuid not null references public.attendance_events(id), check_out_event_id uuid references public.attendance_events(id),
  check_in_time timestamptz not null, check_out_time timestamptz, duration_seconds bigint,
  status public.work_session_status not null default 'OPEN', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create unique index one_open_session_per_worker on public.work_sessions(user_id) where status = 'OPEN';
create index attendance_events_project_time on public.attendance_events(project_id, server_timestamp desc);
create index attendance_events_user_time on public.attendance_events(user_id, server_timestamp desc);
create index work_sessions_project_time on public.work_sessions(project_id, check_in_time desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), admin_user_id uuid not null references public.profiles(id), action text not null,
  entity_type text not null, entity_id uuid not null, old_value jsonb, new_value jsonb, reason text not null check (length(trim(reason)) > 0),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where auth_user_id = auth.uid() and role = 'ADMIN' and status = 'ACTIVE') $$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_assignments enable row level security;
alter table public.attendance_events enable row level security;
alter table public.work_sessions enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_read on public.profiles for select using (auth_user_id = auth.uid() or public.is_admin());
create policy profiles_admin_write on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy projects_read on public.projects for select using (public.is_admin() or exists(select 1 from public.project_assignments pa join public.profiles p on p.id = pa.user_id where pa.project_id = projects.id and pa.status = 'ACTIVE' and p.auth_user_id = auth.uid()));
create policy projects_admin_write on public.projects for all using (public.is_admin()) with check (public.is_admin());
create policy assignments_read on public.project_assignments for select using (public.is_admin() or exists(select 1 from public.profiles p where p.id = user_id and p.auth_user_id = auth.uid()));
create policy assignments_admin_write on public.project_assignments for all using (public.is_admin()) with check (public.is_admin());
create policy events_read on public.attendance_events for select using (public.is_admin() or exists(select 1 from public.profiles p where p.id = user_id and p.auth_user_id = auth.uid()));
create policy sessions_read on public.work_sessions for select using (public.is_admin() or exists(select 1 from public.profiles p where p.id = user_id and p.auth_user_id = auth.uid()));
create policy audit_admin_only on public.audit_logs for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public) values
  ('project-assets', 'project-assets', false),
  ('attendance-originals', 'attendance-originals', false),
  ('attendance-watermarked', 'attendance-watermarked', false)
on conflict (id) do update set public = false;
