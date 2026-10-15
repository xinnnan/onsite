-- Managers review attendance and reports for one company: their own profiles.company.
-- Scoping is enforced by the server API (service role); RLS keeps managers to their own
-- profile like any non-admin, and the existing RPCs still accept only ADMIN or WORKER.
alter type public.user_role add value if not exists 'MANAGER';

-- Compare as text so this runs in the same transaction that adds the enum value.
alter table public.profiles drop constraint if exists profiles_manager_company_required;
alter table public.profiles add constraint profiles_manager_company_required
  check (role::text <> 'MANAGER' or nullif(trim(company), '') is not null);
