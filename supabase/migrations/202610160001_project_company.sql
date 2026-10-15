-- The company that owns a project. Managers create, edit and staff only their own company's
-- projects; projects without a company (all projects created before this) stay with administrators.
alter table public.projects add column if not exists company text;

alter table public.projects drop constraint if exists projects_company_not_blank;
alter table public.projects add constraint projects_company_not_blank
  check (company is null or nullif(trim(company), '') is not null);

create index if not exists projects_company on public.projects(company);
