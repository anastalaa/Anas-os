-- ANAS OS authorization hardening
-- Requires 0001_core_foundation.sql and 0002_role_permissions.sql.
-- This migration is intentionally not a production deployment action.

-- Core permission metadata for the first application slice.
insert into public.permissions(resource, action, description) values
  ('note', 'VIEW', 'View notes'),
  ('note', 'CREATE', 'Create notes'),
  ('note', 'EDIT', 'Edit notes'),
  ('note', 'DELETE', 'Delete notes')
on conflict (resource, action) do nothing;

-- Managers and members need note permissions consistent with the core CRUD model.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.resource = 'note'
  and p.action in ('VIEW', 'CREATE', 'EDIT')
where r.name in ('MANAGER', 'MEMBER')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.resource = 'note' and p.action = 'VIEW'
where r.name in ('COLLABORATOR', 'VIEWER')
on conflict do nothing;

-- ADMIN is an administrative workspace role, so it receives the complete
-- application-level CRUD surface for the current core resources.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'ADMIN'
  and p.resource in ('workspace', 'task', 'project', 'note', 'document')
on conflict do nothing;

-- SECURITY DEFINER is required because this function is called by RLS policies
-- that themselves read workspace_members. The fixed search_path prevents
-- object-shadowing attacks.
create or replace function public.has_workspace_permission(
  target_workspace uuid,
  target_resource text,
  target_action public.permission_action,
  target_user uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1
      from public.workspaces w
      where w.id = target_workspace
        and w.owner_id = coalesce(target_user, auth.uid())
    )
    or exists (
      select 1
      from public.workspace_members wm
      join public.role_permissions rp on rp.role_id = wm.role_id
      join public.permissions p on p.id = rp.permission_id
      where wm.workspace_id = target_workspace
        and wm.user_id = coalesce(target_user, auth.uid())
        and wm.status = 'ACTIVE'
        and p.resource = target_resource
        and p.action = target_action
    );
$$;

-- A newly created workspace must immediately have its owner represented as an
-- active OWNER member. This makes ownership and membership consistent for RLS.
create or replace function public.add_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_role uuid;
begin
  select id into owner_role
  from public.roles
  where name = 'OWNER';

  if owner_role is null then
    raise exception 'OWNER role is not seeded';
  end if;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role_id,
    status,
    joined_at
  ) values (
    new.id,
    new.owner_id,
    owner_role,
    'ACTIVE',
    now()
  )
  on conflict (workspace_id, user_id) do update
    set role_id = excluded.role_id,
        status = 'ACTIVE',
        joined_at = coalesce(public.workspace_members.joined_at, excluded.joined_at),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists workspace_owner_membership on public.workspaces;
create trigger workspace_owner_membership
after insert on public.workspaces
for each row execute procedure public.add_workspace_owner_membership();

-- Backfill ownership for workspaces created before the trigger existed.
insert into public.workspace_members (workspace_id, user_id, role_id, status, joined_at)
select w.id, w.owner_id, r.id, 'ACTIVE', coalesce(w.created_at, now())
from public.workspaces w
cross join public.roles r
where r.name = 'OWNER'
on conflict (workspace_id, user_id) do update
  set role_id = excluded.role_id,
      status = 'ACTIVE',
      updated_at = now();

-- Replace membership-only policies with action-aware policies.
drop policy if exists workspaces_member_select on public.workspaces;
drop policy if exists workspaces_owner_update on public.workspaces;
create policy workspaces_view on public.workspaces
for select using (public.has_workspace_permission(id, 'workspace', 'VIEW'));
create policy workspaces_edit on public.workspaces
for update using (public.has_workspace_permission(id, 'workspace', 'EDIT'))
with check (public.has_workspace_permission(id, 'workspace', 'EDIT'));

-- Workspace membership is visible to members with workspace VIEW and mutable
-- only by owners/admins through SHARE or ADMIN.
drop policy if exists workspace_members_select on public.workspace_members;
drop policy if exists workspace_members_owner_manage on public.workspace_members;
create policy workspace_members_view on public.workspace_members
for select using (public.has_workspace_permission(workspace_id, 'workspace', 'VIEW'));
create policy workspace_members_manage on public.workspace_members
for all using (
  public.has_workspace_permission(workspace_id, 'workspace', 'SHARE')
  or public.has_workspace_permission(workspace_id, 'workspace', 'ADMIN')
)
with check (
  public.has_workspace_permission(workspace_id, 'workspace', 'SHARE')
  or public.has_workspace_permission(workspace_id, 'workspace', 'ADMIN')
);

-- Tasks
drop policy if exists tasks_member_access on public.tasks;
drop policy if exists tasks_member_insert on public.tasks;
drop policy if exists tasks_member_update on public.tasks;
create policy tasks_view on public.tasks
for select using (public.has_workspace_permission(workspace_id, 'task', 'VIEW'));
create policy tasks_create on public.tasks
for insert with check (
  public.has_workspace_permission(workspace_id, 'task', 'CREATE')
  and created_by = auth.uid()
  and updated_by = auth.uid()
);
create policy tasks_edit on public.tasks
for update using (public.has_workspace_permission(workspace_id, 'task', 'EDIT'))
with check (
  public.has_workspace_permission(workspace_id, 'task', 'EDIT')
  and updated_by = auth.uid()
);
create policy tasks_delete on public.tasks
for delete using (public.has_workspace_permission(workspace_id, 'task', 'DELETE'));

-- Projects
drop policy if exists projects_member_access on public.projects;
drop policy if exists projects_member_insert on public.projects;
drop policy if exists projects_member_update on public.projects;
create policy projects_view on public.projects
for select using (public.has_workspace_permission(workspace_id, 'project', 'VIEW'));
create policy projects_create on public.projects
for insert with check (
  public.has_workspace_permission(workspace_id, 'project', 'CREATE')
  and created_by = auth.uid()
  and updated_by = auth.uid()
);
create policy projects_edit on public.projects
for update using (public.has_workspace_permission(workspace_id, 'project', 'EDIT'))
with check (
  public.has_workspace_permission(workspace_id, 'project', 'EDIT')
  and updated_by = auth.uid()
);
create policy projects_delete on public.projects
for delete using (public.has_workspace_permission(workspace_id, 'project', 'DELETE'));

-- Notes
drop policy if exists notes_member_access on public.notes;
drop policy if exists notes_member_insert on public.notes;
drop policy if exists notes_member_update on public.notes;
create policy notes_view on public.notes
for select using (public.has_workspace_permission(workspace_id, 'note', 'VIEW'));
create policy notes_create on public.notes
for insert with check (
  public.has_workspace_permission(workspace_id, 'note', 'CREATE')
  and created_by = auth.uid()
  and updated_by = auth.uid()
);
create policy notes_edit on public.notes
for update using (public.has_workspace_permission(workspace_id, 'note', 'EDIT'))
with check (
  public.has_workspace_permission(workspace_id, 'note', 'EDIT')
  and updated_by = auth.uid()
);
create policy notes_delete on public.notes
for delete using (public.has_workspace_permission(workspace_id, 'note', 'DELETE'));

-- Documents
drop policy if exists documents_member_access on public.documents;
drop policy if exists documents_member_insert on public.documents;
drop policy if exists documents_member_update on public.documents;
create policy documents_view on public.documents
for select using (public.has_workspace_permission(workspace_id, 'document', 'VIEW'));
create policy documents_create on public.documents
for insert with check (
  public.has_workspace_permission(workspace_id, 'document', 'CREATE')
  and created_by = auth.uid()
  and updated_by = auth.uid()
);
create policy documents_edit on public.documents
for update using (public.has_workspace_permission(workspace_id, 'document', 'EDIT'))
with check (
  public.has_workspace_permission(workspace_id, 'document', 'EDIT')
  and updated_by = auth.uid()
);
create policy documents_delete on public.documents
for delete using (public.has_workspace_permission(workspace_id, 'document', 'DELETE'));

-- Document versions inherit the parent document's authorization.
drop policy if exists document_versions_member_access on public.document_versions;
create policy document_versions_view on public.document_versions
for select using (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and public.has_workspace_permission(d.workspace_id, 'document', 'VIEW')
  )
);
create policy document_versions_create on public.document_versions
for insert with check (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and public.has_workspace_permission(d.workspace_id, 'document', 'EDIT')
  )
  and created_by = auth.uid()
);
create policy document_versions_delete on public.document_versions
for delete using (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and public.has_workspace_permission(d.workspace_id, 'document', 'DELETE')
  )
);

-- Role and permission metadata is readable but not client-writable.
create policy roles_authenticated_select on public.roles
for select using (auth.uid() is not null);
create policy permissions_authenticated_select on public.permissions
for select using (auth.uid() is not null);
create policy role_permissions_authenticated_select on public.role_permissions
for select using (auth.uid() is not null);

-- Resource-level grants remain server-managed until their own authorization
-- API exists. RLS therefore stays deny-by-default.

-- Audit/security records are append-only from trusted server-side code. The
-- existing self-select policies remain, but client INSERT/UPDATE/DELETE is not
-- granted here.

-- Grant execute on the security-definer helpers to authenticated users so RLS
-- can evaluate them safely through PostgREST/Supabase.
grant execute on function public.is_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid, uuid) to authenticated;
grant execute on function public.has_workspace_permission(uuid, text, public.permission_action, uuid) to authenticated;
