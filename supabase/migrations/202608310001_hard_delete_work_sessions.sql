create or replace function public.delete_work_session(
  p_session_id uuid,
  p_admin_profile_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.work_sessions%rowtype;
  v_check_in public.attendance_events%rowtype;
  v_check_out public.attendance_events%rowtype;
  v_original_paths text[] := array[]::text[];
  v_watermarked_paths text[] := array[]::text[];
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'DELETION_REASON_REQUIRED';
  end if;

  perform 1
  from public.profiles
  where id = p_admin_profile_id
    and role = 'ADMIN'
    and status = 'ACTIVE';

  if not found then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select * into v_session
  from public.work_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if v_session.check_in_event_id is not null then
    select * into v_check_in
    from public.attendance_events
    where id = v_session.check_in_event_id;
  end if;

  if v_session.check_out_event_id is not null then
    select * into v_check_out
    from public.attendance_events
    where id = v_session.check_out_event_id;
  end if;

  if v_check_in.original_photo_path is not null then
    v_original_paths := array_append(v_original_paths, v_check_in.original_photo_path);
  end if;
  if v_check_out.original_photo_path is not null then
    v_original_paths := array_append(v_original_paths, v_check_out.original_photo_path);
  end if;
  if v_check_in.watermarked_photo_path is not null then
    v_watermarked_paths := array_append(v_watermarked_paths, v_check_in.watermarked_photo_path);
  end if;
  if v_check_out.watermarked_photo_path is not null then
    v_watermarked_paths := array_append(v_watermarked_paths, v_check_out.watermarked_photo_path);
  end if;

  delete from public.audit_logs
  where entity_type = 'WORK_SESSION'
    and entity_id = p_session_id;

  insert into public.audit_logs (
    admin_user_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value,
    reason
  ) values (
    p_admin_profile_id,
    'WORK_SESSION_DELETED',
    'WORK_SESSION',
    p_session_id,
    null,
    jsonb_build_object('deleted', true),
    trim(p_reason)
  );

  delete from public.work_sessions where id = p_session_id;

  delete from public.attendance_events
  where id = v_session.check_in_event_id
     or id = v_session.check_out_event_id;

  return jsonb_build_object(
    'deleted', true,
    'original_photo_paths', to_jsonb(v_original_paths),
    'watermarked_photo_paths', to_jsonb(v_watermarked_paths)
  );
end;
$$;

revoke all on function public.delete_work_session(uuid, uuid, text) from public;
revoke all on function public.delete_work_session(uuid, uuid, text) from anon;
revoke all on function public.delete_work_session(uuid, uuid, text) from authenticated;
grant execute on function public.delete_work_session(uuid, uuid, text) to service_role;
