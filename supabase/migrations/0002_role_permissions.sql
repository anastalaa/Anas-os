-- ANAS OS role-permission seed
-- Idempotent: safe to apply after 0001_core_foundation.sql.

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'OWNER'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on p.resource = 'workspace'
 and p.action in ('VIEW', 'EDIT', 'SHARE', 'ADMIN')
where r.name = 'ADMIN'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on (
    (p.resource = 'workspace' and p.action = 'VIEW')
    or (p.resource in ('task', 'project') and p.action in ('VIEW', 'CREATE', 'EDIT'))
    or (p.resource = 'document' and p.action in ('VIEW', 'CREATE', 'EDIT'))
  )
where r.name = 'MANAGER'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on (
    (p.resource in ('workspace', 'task', 'project', 'document') and p.action = 'VIEW')
    or (p.resource in ('task', 'project', 'document') and p.action in ('CREATE', 'EDIT'))
  )
where r.name = 'MEMBER'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on (
    (p.resource in ('workspace', 'task', 'project', 'document') and p.action = 'VIEW')
    or (p.resource in ('task', 'project', 'document') and p.action = 'COMMENT')
  )
where r.name = 'COLLABORATOR'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on p.resource in ('workspace', 'task', 'project', 'document')
 and p.action = 'VIEW'
where r.name = 'VIEWER'
on conflict do nothing;
