alter table public.projects
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(10,6);

alter table public.projects drop constraint if exists projects_latitude_range;
alter table public.projects add constraint projects_latitude_range
  check (latitude is null or latitude between -90 and 90);
alter table public.projects drop constraint if exists projects_longitude_range;
alter table public.projects add constraint projects_longitude_range
  check (longitude is null or longitude between -180 and 180);
alter table public.projects drop constraint if exists projects_coordinate_pair;
alter table public.projects add constraint projects_coordinate_pair
  check ((latitude is null) = (longitude is null));

alter table public.attendance_events
  add column if not exists project_latitude_snapshot numeric(9,6),
  add column if not exists project_longitude_snapshot numeric(10,6);

alter table public.work_sessions
  add column if not exists daily_work_summary text;

alter table public.work_sessions drop constraint if exists work_sessions_daily_summary_length;
alter table public.work_sessions add constraint work_sessions_daily_summary_length
  check (daily_work_summary is null or char_length(daily_work_summary) <= 1000);

create or replace function public.is_valid_work_summary(p_summary text)
returns boolean
language sql immutable set search_path = public
as $$
  select
    p_summary is not null
    and char_length(trim(p_summary)) between 1 and 1000
    and (
      char_length(regexp_replace(p_summary, '[^一-龥]', '', 'g')) >= 20
      or cardinality(regexp_split_to_array(trim(p_summary), '[[:space:]]+')) >= 10
      or char_length(regexp_replace(p_summary, '[[:space:]]', '', 'g')) >= 40
    );
$$;

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
    project_timezone_snapshot, project_map_path_snapshot, project_latitude_snapshot,
    project_longitude_snapshot, original_photo_path, watermarked_photo_path, photo_hash
  ) values (
    p_event_id, 'ATT-' || upper(substr(replace(p_event_id::text, '-', ''), 1, 12)), p_user_id, p_project_id,
    'CHECK_IN', p_server_timestamp, p_client_capture_time, v_project.project_name, v_project.customer_name,
    v_project.site_name, v_address, v_project.timezone, v_project.map_image_path, v_project.latitude,
    v_project.longitude, p_original_photo_path, p_watermarked_photo_path, p_photo_hash
  ) returning * into v_event;

  insert into public.work_sessions (
    user_id, project_id, check_in_event_id, check_in_time, status
  ) values (p_user_id, p_project_id, v_event.id, v_event.server_timestamp, 'OPEN')
  returning * into v_session;

  return jsonb_build_object('event', to_jsonb(v_event), 'session', to_jsonb(v_session));
end;
$$;

revoke all on function public.create_check_out(uuid,uuid,text,text,text,timestamptz,timestamptz) from public, anon, authenticated, service_role;
drop function public.create_check_out(uuid,uuid,text,text,text,timestamptz,timestamptz);

create function public.create_check_out(
  p_user_id uuid,
  p_event_id uuid,
  p_original_photo_path text,
  p_watermarked_photo_path text,
  p_photo_hash text,
  p_client_capture_time timestamptz,
  p_server_timestamp timestamptz,
  p_daily_work_summary text
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
  if not public.is_valid_work_summary(p_daily_work_summary) then
    raise exception 'WORK_SUMMARY_TOO_SHORT';
  end if;

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
    project_timezone_snapshot, project_map_path_snapshot, project_latitude_snapshot,
    project_longitude_snapshot, original_photo_path, watermarked_photo_path, photo_hash
  ) values (
    p_event_id, 'ATT-' || upper(substr(replace(p_event_id::text, '-', ''), 1, 12)), p_user_id, v_project.id,
    'CHECK_OUT', p_server_timestamp, p_client_capture_time, v_project.project_name, v_project.customer_name,
    v_project.site_name, v_address, v_project.timezone, v_project.map_image_path, v_project.latitude,
    v_project.longitude, p_original_photo_path, p_watermarked_photo_path, p_photo_hash
  ) returning * into v_event;

  v_duration := greatest(0, extract(epoch from (v_event.server_timestamp - v_session.check_in_time))::bigint);
  update public.work_sessions set
    check_out_event_id = v_event.id,
    check_out_time = v_event.server_timestamp,
    duration_seconds = v_duration,
    daily_work_summary = trim(p_daily_work_summary),
    status = case when v_duration > 64800 then 'LONG_SESSION'::public.work_session_status else 'COMPLETE'::public.work_session_status end
  where id = v_session.id returning * into v_session;

  return jsonb_build_object('event', to_jsonb(v_event), 'session', to_jsonb(v_session));
end;
$$;

revoke all on function public.is_valid_work_summary(text) from public, anon, authenticated;
revoke all on function public.create_check_in(uuid,uuid,uuid,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.create_check_out(uuid,uuid,text,text,text,timestamptz,timestamptz,text) from public, anon, authenticated;
grant execute on function public.create_check_in(uuid,uuid,uuid,text,text,text,timestamptz,timestamptz) to service_role;
grant execute on function public.create_check_out(uuid,uuid,text,text,text,timestamptz,timestamptz,text) to service_role;
