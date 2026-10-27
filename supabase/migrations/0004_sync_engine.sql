-- ANAS OS offline sync engine
-- Defines server-side version monotonicity. Applying migrations to production
-- remains an explicit deployment decision.

create or replace function public.bump_entity_version()
returns trigger
language plpgsql
as $$
begin
  if new.version is null or new.version <= old.version then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_version_bump on public.tasks;
create trigger tasks_version_bump
before update on public.tasks
for each row execute procedure public.bump_entity_version();

drop trigger if exists projects_version_bump on public.projects;
create trigger projects_version_bump
before update on public.projects
for each row execute procedure public.bump_entity_version();

drop trigger if exists notes_version_bump on public.notes;
create trigger notes_version_bump
before update on public.notes
for each row execute procedure public.bump_entity_version();

drop trigger if exists documents_version_bump on public.documents;
create trigger documents_version_bump
before update on public.documents
for each row execute procedure public.bump_entity_version();

create index if not exists sync_workspace_entity_idx
  on public.sync_operations(workspace_id, entity_type, entity_id, created_at desc);

create index if not exists devices_user_last_seen_idx
  on public.devices(user_id, last_seen_at desc);
