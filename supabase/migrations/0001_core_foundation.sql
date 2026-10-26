-- ANAS OS core foundation
-- Production application of this migration requires an explicit deployment decision.

create extension if not exists pgcrypto;
create extension if not exists vector;

create type public.workspace_type as enum ('PERSONAL', 'FAMILY', 'PROFESSIONAL', 'PROJECT', 'SHARED');
create type public.member_status as enum ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');
create type public.role_name as enum ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'COLLABORATOR', 'VIEWER');
create type public.permission_action as enum ('VIEW', 'COMMENT', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'SHARE', 'ADMIN');
create type public.task_status as enum ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');
create type public.task_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
create type public.project_status as enum ('PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED', 'CANCELLED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  locale text not null default 'en',
  timezone text not null default 'Africa/Casablanca',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type public.workspace_type not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete restrict,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name public.role_name not null unique,
  description text,
  system_role boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  resource text not null,
  action public.permission_action not null,
  description text,
  created_at timestamptz not null default now(),
  unique(resource, action)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key(role_id, permission_id)
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  status public.member_status not null default 'ACTIVE',
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);

create table public.resource_permissions (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null,
  resource_id uuid not null,
  subject_type text not null check (subject_type in ('USER', 'ROLE', 'WORKSPACE')),
  subject_id uuid not null,
  permission public.permission_action not null,
  granted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  status public.task_status not null default 'TODO',
  priority public.task_priority not null default 'MEDIUM',
  due_at timestamptz,
  completed_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  parent_task_id uuid references public.tasks(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  status public.project_status not null default 'PLANNED',
  priority public.task_priority not null default 'MEDIUM',
  start_date date,
  target_date date,
  owner_id uuid not null references auth.users(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  plain_text text,
  note_type text not null default 'NOTE',
  owner_id uuid not null references auth.users(id) on delete restrict,
  version bigint not null default 1,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  mime_type text not null,
  category text,
  storage_path text not null,
  file_size bigint,
  checksum text,
  extracted_text text,
  metadata jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_number bigint not null,
  storage_path text not null,
  checksum text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(document_id, version_number)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_hash text,
  user_agent text,
  request_id uuid,
  created_at timestamptz not null default now()
);

create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null default 'INFO',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null,
  device_type text,
  platform text,
  app_version text,
  last_seen_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.sync_operations (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  operation text not null check (operation in ('CREATE', 'UPDATE', 'DELETE', 'RESTORE')),
  payload jsonb not null default '{}'::jsonb,
  base_version bigint,
  client_timestamp timestamptz not null,
  server_timestamp timestamptz,
  status text not null default 'PENDING' check (status in ('PENDING', 'SYNCING', 'SYNCED', 'CONFLICT', 'FAILED')),
  error_code text,
  created_at timestamptz not null default now()
);

create index workspace_members_user_idx on public.workspace_members(user_id);
create index tasks_workspace_idx on public.tasks(workspace_id) where deleted_at is null;
create index projects_workspace_idx on public.projects(workspace_id) where deleted_at is null;
create index notes_workspace_idx on public.notes(workspace_id) where deleted_at is null;
create index documents_workspace_idx on public.documents(workspace_id) where deleted_at is null;
create index audit_workspace_idx on public.audit_logs(workspace_id, created_at desc);
create index sync_user_status_idx on public.sync_operations(user_id, status, created_at);

create or replace function public.is_workspace_member(target_workspace uuid, target_user uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = coalesce(target_user, auth.uid())
      and wm.status = 'ACTIVE'
  );
$$;

create or replace function public.is_workspace_owner(target_workspace uuid, target_user uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace
      and w.owner_id = coalesce(target_user, auth.uid())
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.workspace_members enable row level security;
alter table public.resource_permissions enable row level security;
alter table public.tasks enable row level security;
alter table public.projects enable row level security;
alter table public.notes enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.security_events enable row level security;
alter table public.devices enable row level security;
alter table public.sync_operations enable row level security;

create policy profiles_self_select on public.profiles for select using (id = auth.uid());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy workspaces_member_select on public.workspaces for select using (public.is_workspace_member(id));
create policy workspaces_owner_insert on public.workspaces for insert with check (owner_id = auth.uid());
create policy workspaces_owner_update on public.workspaces for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy workspace_members_select on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy workspace_members_owner_manage on public.workspace_members for all using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

create policy tasks_member_access on public.tasks for select using (public.is_workspace_member(workspace_id));
create policy tasks_member_insert on public.tasks for insert with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy tasks_member_update on public.tasks for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy projects_member_access on public.projects for select using (public.is_workspace_member(workspace_id));
create policy projects_member_insert on public.projects for insert with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy projects_member_update on public.projects for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy notes_member_access on public.notes for select using (public.is_workspace_member(workspace_id));
create policy notes_member_insert on public.notes for insert with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy notes_member_update on public.notes for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy documents_member_access on public.documents for select using (public.is_workspace_member(workspace_id));
create policy documents_member_insert on public.documents for insert with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy documents_member_update on public.documents for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create policy document_versions_member_access on public.document_versions for select using (
  exists (select 1 from public.documents d where d.id = document_id and public.is_workspace_member(d.workspace_id))
);

create policy devices_self_access on public.devices for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sync_self_access on public.sync_operations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy audit_self_select on public.audit_logs for select using (user_id = auth.uid());
create policy security_events_self_select on public.security_events for select using (user_id = auth.uid());

insert into public.roles(name, description, system_role) values
  ('OWNER', 'Full control of owned workspace and system-level personal resources.', true),
  ('ADMIN', 'Administrative workspace management.', true),
  ('MANAGER', 'Team and project management.', true),
  ('MEMBER', 'Standard workspace member.', true),
  ('COLLABORATOR', 'Limited collaboration access.', true),
  ('VIEWER', 'Read-only workspace access.', true)
on conflict (name) do nothing;

insert into public.permissions(resource, action, description) values
  ('workspace', 'VIEW', 'View workspace'),
  ('workspace', 'CREATE', 'Create workspace'),
  ('workspace', 'EDIT', 'Edit workspace'),
  ('workspace', 'DELETE', 'Delete workspace'),
  ('workspace', 'SHARE', 'Share workspace'),
  ('workspace', 'ADMIN', 'Administer workspace'),
  ('task', 'VIEW', 'View tasks'),
  ('task', 'CREATE', 'Create tasks'),
  ('task', 'EDIT', 'Edit tasks'),
  ('task', 'DELETE', 'Delete tasks'),
  ('project', 'VIEW', 'View projects'),
  ('project', 'CREATE', 'Create projects'),
  ('project', 'EDIT', 'Edit projects'),
  ('project', 'DELETE', 'Delete projects'),
  ('document', 'VIEW', 'View documents'),
  ('document', 'CREATE', 'Create documents'),
  ('document', 'EDIT', 'Edit documents'),
  ('document', 'DELETE', 'Delete documents'),
  ('document', 'EXPORT', 'Export documents'),
  ('document', 'SHARE', 'Share documents')
on conflict (resource, action) do nothing;
