create table if not exists public.crm_client_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.crm_organizations(id) on delete cascade,
  client_id uuid not null references public.crm_clients(id) on delete cascade,
  project_name text not null default 'Website Project',
  project_status text not null default 'in_progress',
  live_url text,
  preview_url text,
  current_phase text not null default 'Design Review',
  client_instructions text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id)
);

create table if not exists public.crm_project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.crm_client_projects(id) on delete cascade,
  client_id uuid not null references public.crm_clients(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  author_role text not null default 'client',
  body text not null,
  page_url text,
  marker_x numeric(6,3),
  marker_y numeric(6,3),
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.crm_project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.crm_client_projects(id) on delete cascade,
  client_id uuid not null references public.crm_clients(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  file_name text not null,
  file_type text,
  file_size bigint not null default 0,
  storage_bucket text not null default 'client-project-files',
  storage_path text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists crm_client_projects_client_idx on public.crm_client_projects (client_id);
create index if not exists crm_project_comments_project_idx on public.crm_project_comments (project_id, created_at desc);
create index if not exists crm_project_files_project_idx on public.crm_project_files (project_id, created_at desc);

alter table public.crm_client_projects enable row level security;
alter table public.crm_project_comments enable row level security;
alter table public.crm_project_files enable row level security;

grant select, insert, update, delete on public.crm_client_projects to service_role;
grant select, insert, update, delete on public.crm_project_comments to service_role;
grant select, insert, update, delete on public.crm_project_files to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-project-files',
  'client-project-files',
  false,
  52428800,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'text/plain'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_client_projects'
      and policyname = 'clients can read their own projects'
  ) then
    create policy "clients can read their own projects"
    on public.crm_client_projects
    for select
    to authenticated
    using (
      exists (
        select 1 from public.crm_clients c
        where c.id = crm_client_projects.client_id
          and c.portal_user_id = (select auth.uid())
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_project_comments'
      and policyname = 'clients can read their own project comments'
  ) then
    create policy "clients can read their own project comments"
    on public.crm_project_comments
    for select
    to authenticated
    using (
      exists (
        select 1 from public.crm_clients c
        where c.id = crm_project_comments.client_id
          and c.portal_user_id = (select auth.uid())
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_project_files'
      and policyname = 'clients can read their own project files'
  ) then
    create policy "clients can read their own project files"
    on public.crm_project_files
    for select
    to authenticated
    using (
      exists (
        select 1 from public.crm_clients c
        where c.id = crm_project_files.client_id
          and c.portal_user_id = (select auth.uid())
      )
    );
  end if;
end $$;
