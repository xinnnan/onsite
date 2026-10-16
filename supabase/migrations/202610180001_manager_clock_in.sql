-- Managers clock in and out on site like workers, so their sessions appear in attendance records
-- and reports. Administrators can also add attendance for managers; managers still add records only
-- for their own company's workers. Only the role checks change from 202608170003 and 202610170001.

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
  select * into v_profile from public.profiles where id = p_user_id and status = 'ACTIVE' and role in ('WORKER', 'MANAGER');
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

create or replace function public.create_check_out(
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

  select * into v_profile from public.profiles where id = p_user_id and status = 'ACTIVE' and role in ('WORKER', 'MANAGER');
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

create or replace function public.create_manual_attendance(
  p_user_id uuid,
  p_project_id uuid,
  p_check_in_time timestamptz,
  p_check_out_time timestamptz,
  p_admin_note text,
  p_admin_profile_id uuid
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_project public.projects%rowtype;
  v_admin public.profiles%rowtype;
  v_check_in_event public.attendance_events%rowtype;
  v_check_out_event public.attendance_events%rowtype;
  v_session public.work_sessions%rowtype;
  v_check_in_event_id uuid := gen_random_uuid();
  v_check_out_event_id uuid := case when p_check_out_time is null then null else gen_random_uuid() end;
  v_address text;
  v_duration bigint;
  v_status public.work_session_status;
begin
  select * into v_admin from public.profiles
  where id = p_admin_profile_id and role in ('ADMIN', 'MANAGER') and status = 'ACTIVE';
  if not found then raise exception 'ADMIN_NOT_ACTIVE'; end if;

  select * into v_profile from public.profiles
  where id = p_user_id and role in ('WORKER', 'MANAGER') and status = 'ACTIVE';
  if not found then raise exception 'WORKER_NOT_ACTIVE'; end if;
  if v_admin.role = 'MANAGER'
    and nullif(trim(v_profile.company), '') is distinct from nullif(trim(v_admin.company), '') then
    raise exception 'WORKER_NOT_ACTIVE';
  end if;
  -- Managers add records for their workers; managers' own records are added by administrators.
  if v_admin.role = 'MANAGER' and v_profile.role <> 'WORKER' then
    raise exception 'MANAGER_RECORDS_ADMIN_ONLY';
  end if;

  select * into v_project from public.projects
  where id = p_project_id and status = 'ACTIVE';
  if not found then raise exception 'PROJECT_NOT_ACTIVE'; end if;

  if p_check_in_time is null then raise exception 'CHECK_IN_REQUIRED'; end if;
  if p_check_out_time is not null and p_check_out_time <= p_check_in_time then
    raise exception 'CHECK_OUT_BEFORE_CHECK_IN';
  end if;
  if p_admin_note is not null and char_length(p_admin_note) > 1000 then
    raise exception 'ADMIN_NOTE_TOO_LONG';
  end if;
  if exists (
    select 1 from public.work_sessions existing
    where existing.user_id = p_user_id
      and existing.status <> 'VOID'
      and tstzrange(existing.check_in_time, existing.check_out_time, '[)')
        && tstzrange(p_check_in_time, p_check_out_time, '[)')
  ) then
    raise exception 'ATTENDANCE_TIME_OVERLAP';
  end if;

  v_address := concat_ws(', ', nullif(v_project.address_line_1, ''), nullif(v_project.address_line_2, ''),
    nullif(concat_ws(' ', nullif(v_project.city, ''), nullif(v_project.state, ''), nullif(v_project.postal_code, '')), ''));

  insert into public.attendance_events (
    id, record_code, user_id, project_id, event_type, server_timestamp, client_capture_time,
    project_name_snapshot, customer_name_snapshot, site_name_snapshot, project_address_snapshot,
    project_timezone_snapshot, project_map_path_snapshot, project_latitude_snapshot,
    project_longitude_snapshot, original_photo_path, watermarked_photo_path, photo_hash
  ) values (
    v_check_in_event_id, 'ATT-' || upper(substr(replace(v_check_in_event_id::text, '-', ''), 1, 12)),
    p_user_id, p_project_id, 'CHECK_IN', p_check_in_time, null,
    v_project.project_name, v_project.customer_name, v_project.site_name, v_address,
    v_project.timezone, v_project.map_image_path, v_project.latitude, v_project.longitude,
    null, null, null
  ) returning * into v_check_in_event;

  if p_check_out_time is not null then
    insert into public.attendance_events (
      id, record_code, user_id, project_id, event_type, server_timestamp, client_capture_time,
      project_name_snapshot, customer_name_snapshot, site_name_snapshot, project_address_snapshot,
      project_timezone_snapshot, project_map_path_snapshot, project_latitude_snapshot,
      project_longitude_snapshot, original_photo_path, watermarked_photo_path, photo_hash
    ) values (
      v_check_out_event_id, 'ATT-' || upper(substr(replace(v_check_out_event_id::text, '-', ''), 1, 12)),
      p_user_id, p_project_id, 'CHECK_OUT', p_check_out_time, null,
      v_project.project_name, v_project.customer_name, v_project.site_name, v_address,
      v_project.timezone, v_project.map_image_path, v_project.latitude, v_project.longitude,
      null, null, null
    ) returning * into v_check_out_event;
    v_duration := greatest(0, extract(epoch from (p_check_out_time - p_check_in_time))::bigint);
    v_status := case when v_duration > 64800 then 'LONG_SESSION'::public.work_session_status else 'MANUALLY_CORRECTED'::public.work_session_status end;
  else
    v_duration := null;
    v_status := 'OPEN'::public.work_session_status;
  end if;

  insert into public.work_sessions (
    user_id, project_id, check_in_event_id, check_out_event_id, check_in_time, check_out_time,
    duration_seconds, status, is_manual_entry, admin_note, created_by_admin_id
  ) values (
    p_user_id, p_project_id, v_check_in_event.id, v_check_out_event.id, p_check_in_time, p_check_out_time,
    v_duration, v_status, true, nullif(trim(p_admin_note), ''), p_admin_profile_id
  ) returning * into v_session;

  return jsonb_build_object(
    'check_in_event', to_jsonb(v_check_in_event),
    'check_out_event', case when v_check_out_event.id is null then null else to_jsonb(v_check_out_event) end,
    'session', to_jsonb(v_session)
  );
end;
$$;

revoke all on function public.create_check_in(uuid,uuid,uuid,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.create_check_out(uuid,uuid,text,text,text,timestamptz,timestamptz,text) from public, anon, authenticated;
revoke all on function public.create_manual_attendance(uuid,uuid,timestamptz,timestamptz,text,uuid) from public, anon, authenticated;
grant execute on function public.create_check_in(uuid,uuid,uuid,text,text,text,timestamptz,timestamptz) to service_role;
grant execute on function public.create_check_out(uuid,uuid,text,text,text,timestamptz,timestamptz,text) to service_role;
grant execute on function public.create_manual_attendance(uuid,uuid,timestamptz,timestamptz,text,uuid) to service_role;
