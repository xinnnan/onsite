alter table public.attendance_events
  alter column original_photo_path drop not null,
  alter column watermarked_photo_path drop not null,
  alter column photo_hash drop not null;

alter table public.work_sessions
  add column if not exists is_manual_entry boolean not null default false,
  add column if not exists admin_note text,
  add column if not exists created_by_admin_id uuid references public.profiles(id);

alter table public.work_sessions drop constraint if exists work_sessions_admin_note_length;
alter table public.work_sessions add constraint work_sessions_admin_note_length
  check (admin_note is null or char_length(admin_note) <= 1000);

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
  where id = p_admin_profile_id and role = 'ADMIN' and status = 'ACTIVE';
  if not found then raise exception 'ADMIN_NOT_ACTIVE'; end if;

  select * into v_profile from public.profiles
  where id = p_user_id and role = 'WORKER' and status = 'ACTIVE';
  if not found then raise exception 'WORKER_NOT_ACTIVE'; end if;

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

revoke all on function public.create_manual_attendance(uuid,uuid,timestamptz,timestamptz,text,uuid) from public, anon, authenticated;
grant execute on function public.create_manual_attendance(uuid,uuid,timestamptz,timestamptz,text,uuid) to service_role;
