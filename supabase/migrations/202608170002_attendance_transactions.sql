alter table public.attendance_events add column if not exists record_code text;
update public.attendance_events
set record_code = 'ATT-' || upper(substr(replace(id::text, '-', ''), 1, 12))
where record_code is null;
alter table public.attendance_events alter column record_code set not null;
create unique index if not exists attendance_events_record_code_key on public.attendance_events(record_code);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();
drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at before update on public.projects
for each row execute function public.touch_updated_at();
drop trigger if exists sessions_touch_updated_at on public.work_sessions;
create trigger sessions_touch_updated_at before update on public.work_sessions
for each row execute function public.touch_updated_at();

create or replace function public.create_check_in(
  p_user_id uuid,
  p_project_id uuid,
  p_event_id uuid,
  p_original_photo_path text,
  p_watermarked_photo_path text,
  p_photo_hash text,
  p_client_capture_time timestamptz,
  p_server_timestamp timestamptz
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_project public.projects%rowtype;
  v_event public.attendance_events%rowtype;
  v_session public.work_sessions%rowtype;
  v_address text;
begin
  select * into v_profile from public.profiles where id = p_user_id and status = 'ACTIVE' and role = 'WORKER';
  if not found then raise exception 'WORKER_NOT_ACTIVE'; end if;

  select * into v_project from public.projects where id = p_project_id and status = 'ACTIVE';
  if not found then raise exception 'PROJECT_NOT_ACTIVE'; end if;

  if not exists (
    select 1 from public.project_assignments
    where user_id = p_user_id and project_id = p_project_id and status = 'ACTIVE'
  ) then raise exception 'PROJECT_NOT_ASSIGNED'; end if;

  if exists (select 1 from public.work_sessions where user_id = p_user_id and status = 'OPEN') then
    raise exception 'OPEN_SESSION_EXISTS';
  end if;

  v_address := concat_ws(', ', nullif(v_project.address_line_1, ''), nullif(v_project.address_line_2, ''),
    nullif(concat_ws(' ', nullif(v_project.city, ''), nullif(v_project.state, ''), nullif(v_project.postal_code, '')), ''));

  insert into public.attendance_events (
    id, record_code, user_id, project_id, event_type, server_timestamp, client_capture_time,
    project_name_snapshot, customer_name_snapshot, site_name_snapshot, project_address_snapshot,
    project_timezone_snapshot, project_map_path_snapshot, original_photo_path,
    watermarked_photo_path, photo_hash
  ) values (
    p_event_id, 'ATT-' || upper(substr(replace(p_event_id::text, '-', ''), 1, 12)), p_user_id, p_project_id,
    'CHECK_IN', p_server_timestamp, p_client_capture_time, v_project.project_name, v_project.customer_name,
    v_project.site_name, v_address, v_project.timezone, v_project.map_image_path,
    p_original_photo_path, p_watermarked_photo_path, p_photo_hash
  ) returning * into v_event;

  insert into public.work_sessions (
    user_id, project_id, check_in_event_id, check_in_time, status
  ) values (p_user_id, p_project_id, v_event.id, v_event.server_timestamp, 'OPEN')
  returning * into v_session;

  return jsonb_build_object('event', to_jsonb(v_event), 'session', to_jsonb(v_session));
end;
$$;

create or replace function public.create_check_out(
  p_user_id uuid,
  p_event_id uuid,
  p_original_photo_path text,
  p_watermarked_photo_path text,
  p_photo_hash text,
  p_client_capture_time timestamptz,
  p_server_timestamp timestamptz
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_project public.projects%rowtype;
  v_event public.attendance_events%rowtype;
  v_session public.work_sessions%rowtype;
  v_address text;
  v_duration bigint;
begin
  select * into v_profile from public.profiles where id = p_user_id and status = 'ACTIVE' and role = 'WORKER';
  if not found then raise exception 'WORKER_NOT_ACTIVE'; end if;

  select * into v_session from public.work_sessions
  where user_id = p_user_id and status = 'OPEN'
  order by check_in_time desc limit 1 for update;
  if not found then raise exception 'OPEN_SESSION_NOT_FOUND'; end if;

  select * into v_project from public.projects where id = v_session.project_id;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;

  v_address := concat_ws(', ', nullif(v_project.address_line_1, ''), nullif(v_project.address_line_2, ''),
    nullif(concat_ws(' ', nullif(v_project.city, ''), nullif(v_project.state, ''), nullif(v_project.postal_code, '')), ''));

  insert into public.attendance_events (
    id, record_code, user_id, project_id, event_type, server_timestamp, client_capture_time,
    project_name_snapshot, customer_name_snapshot, site_name_snapshot, project_address_snapshot,
    project_timezone_snapshot, project_map_path_snapshot, original_photo_path,
    watermarked_photo_path, photo_hash
  ) values (
    p_event_id, 'ATT-' || upper(substr(replace(p_event_id::text, '-', ''), 1, 12)), p_user_id, v_project.id,
    'CHECK_OUT', p_server_timestamp, p_client_capture_time, v_project.project_name, v_project.customer_name,
    v_project.site_name, v_address, v_project.timezone, v_project.map_image_path,
    p_original_photo_path, p_watermarked_photo_path, p_photo_hash
  ) returning * into v_event;

  v_duration := greatest(0, extract(epoch from (v_event.server_timestamp - v_session.check_in_time))::bigint);
  update public.work_sessions set
    check_out_event_id = v_event.id,
    check_out_time = v_event.server_timestamp,
    duration_seconds = v_duration,
    status = case when v_duration > 64800 then 'LONG_SESSION'::public.work_session_status else 'COMPLETE'::public.work_session_status end
  where id = v_session.id returning * into v_session;

  return jsonb_build_object('event', to_jsonb(v_event), 'session', to_jsonb(v_session));
end;
$$;

revoke all on function public.create_check_in(uuid,uuid,uuid,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.create_check_out(uuid,uuid,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.create_check_in(uuid,uuid,uuid,text,text,text,timestamptz,timestamptz) to service_role;
grant execute on function public.create_check_out(uuid,uuid,text,text,text,timestamptz,timestamptz) to service_role;

grant usage on schema public to authenticated, service_role;
grant select on public.profiles, public.projects, public.project_assignments, public.attendance_events, public.work_sessions, public.audit_logs to authenticated;
grant all on public.profiles, public.projects, public.project_assignments, public.attendance_events, public.work_sessions, public.audit_logs to service_role;
grant usage, select on all sequences in schema public to service_role;
