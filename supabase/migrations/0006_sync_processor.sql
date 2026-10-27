-- Transactional server-side application of queued offline operations.
-- Apply locally/staging first. Production database changes remain an explicit decision.

alter table public.documents
  add column if not exists deleted_at timestamptz;

alter table public.sync_operations
  add column if not exists server_version bigint;

create index if not exists sync_pending_queue_idx
  on public.sync_operations(status, created_at)
  where status in ('PENDING', 'SYNCING');

create or replace function public.process_sync_operation(target_operation_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  op public.sync_operations%rowtype;
  current_version bigint;
  target_version bigint;
  required_action public.permission_action;
begin
  select *
    into op
    from public.sync_operations
   where id = target_operation_id
     and user_id = auth.uid()
   for update;

  if not found then
    raise exception 'Sync operation not found' using errcode = 'P0002';
  end if;

  if op.status in ('SYNCED', 'CONFLICT', 'FAILED') then
    return jsonb_build_object(
      'id', op.id,
      'status', op.status,
      'error_code', op.error_code,
      'server_version', op.server_version,
      'server_timestamp', op.server_timestamp
    );
  end if;

  if op.workspace_id is null then
    update public.sync_operations
       set status = 'FAILED', error_code = 'WORKSPACE_REQUIRED', server_timestamp = now()
     where id = op.id;
    return jsonb_build_object('id', op.id, 'status', 'FAILED', 'error_code', 'WORKSPACE_REQUIRED');
  end if;

  required_action := case op.operation
    when 'CREATE' then 'CREATE'::public.permission_action
    when 'UPDATE' then 'EDIT'::public.permission_action
    when 'DELETE' then 'DELETE'::public.permission_action
    else null
  end;

  if required_action is null or not public.has_workspace_permission(
    op.workspace_id, op.entity_type, required_action, auth.uid()
  ) then
    update public.sync_operations
       set status = 'FAILED', error_code = 'FORBIDDEN', server_timestamp = now()
     where id = op.id;
    return jsonb_build_object('id', op.id, 'status', 'FAILED', 'error_code', 'FORBIDDEN');
  end if;

  update public.sync_operations set status = 'SYNCING', error_code = null where id = op.id;

  begin
    if op.operation = 'CREATE' then
      case op.entity_type
        when 'task' then
          if nullif(btrim(op.payload ->> 'title'), '') is null then
            update public.sync_operations set status = 'FAILED', error_code = 'INVALID_PAYLOAD', server_timestamp = now() where id = op.id;
            return jsonb_build_object('id', op.id, 'status', 'FAILED', 'error_code', 'INVALID_PAYLOAD');
          end if;
          insert into public.tasks (
            id, workspace_id, title, description, status, priority, due_at,
            assigned_to, parent_task_id, metadata, created_by, updated_by
          ) values (
            op.entity_id, op.workspace_id, btrim(op.payload ->> 'title'),
            op.payload ->> 'description',
            coalesce((op.payload ->> 'status')::public.task_status, 'TODO'::public.task_status),
            coalesce((op.payload ->> 'priority')::public.task_priority, 'MEDIUM'::public.task_priority),
            nullif(op.payload ->> 'due_at', '')::timestamptz,
            nullif(op.payload ->> 'assigned_to', '')::uuid,
            nullif(op.payload ->> 'parent_task_id', '')::uuid,
            case when jsonb_typeof(op.payload -> 'metadata') = 'object' then op.payload -> 'metadata' else '{}'::jsonb end,
            auth.uid(), auth.uid()
          );
          target_version := 1;

        when 'project' then
          if nullif(btrim(op.payload ->> 'name'), '') is null then
            update public.sync_operations set status = 'FAILED', error_code = 'INVALID_PAYLOAD', server_timestamp = now() where id = op.id;
            return jsonb_build_object('id', op.id, 'status', 'FAILED', 'error_code', 'INVALID_PAYLOAD');
          end if;
          insert into public.projects (
            id, workspace_id, name, description, status, priority, start_date,
            target_date, owner_id, metadata, created_by, updated_by
          ) values (
            op.entity_id, op.workspace_id, btrim(op.payload ->> 'name'),
            op.payload ->> 'description',
            coalesce((op.payload ->> 'status')::public.project_status, 'PLANNED'::public.project_status),
            coalesce((op.payload ->> 'priority')::public.task_priority, 'MEDIUM'::public.task_priority),
            nullif(op.payload ->> 'start_date', '')::date,
            nullif(op.payload ->> 'target_date', '')::date,
            auth.uid(),
            case when jsonb_typeof(op.payload -> 'metadata') = 'object' then op.payload -> 'metadata' else '{}'::jsonb end,
            auth.uid(), auth.uid()
          );
          target_version := 1;

        when 'note' then
          if nullif(btrim(op.payload ->> 'title'), '') is null then
            update public.sync_operations set status = 'FAILED', error_code = 'INVALID_PAYLOAD', server_timestamp = now() where id = op.id;
            return jsonb_build_object('id', op.id, 'status', 'FAILED', 'error_code', 'INVALID_PAYLOAD');
          end if;
          insert into public.notes (
            id, workspace_id, title, content, plain_text, note_type,
            owner_id, created_by, updated_by
          ) values (
            op.entity_id, op.workspace_id, btrim(op.payload ->> 'title'),
            case when jsonb_typeof(op.payload -> 'content') = 'object' then op.payload -> 'content' else '{}'::jsonb end,
            op.payload ->> 'plain_text',
            coalesce(nullif(op.payload ->> 'note_type', ''), 'NOTE'),
            auth.uid(), auth.uid(), auth.uid()
          );
          target_version := 1;

        when 'document' then
          if nullif(btrim(op.payload ->> 'name'), '') is null
             or nullif(btrim(op.payload ->> 'mime_type'), '') is null
             or nullif(btrim(op.payload ->> 'storage_path'), '') is null then
            update public.sync_operations set status = 'FAILED', error_code = 'INVALID_PAYLOAD', server_timestamp = now() where id = op.id;
            return jsonb_build_object('id', op.id, 'status', 'FAILED', 'error_code', 'INVALID_PAYLOAD');
          end if;
          insert into public.documents (
            id, workspace_id, owner_id, name, mime_type, category, storage_path,
            file_size, checksum, extracted_text, metadata, created_by, updated_by
          ) values (
            op.entity_id, op.workspace_id, auth.uid(), btrim(op.payload ->> 'name'),
            btrim(op.payload ->> 'mime_type'), op.payload ->> 'category',
            btrim(op.payload ->> 'storage_path'),
            nullif(op.payload ->> 'file_size', '')::bigint,
            op.payload ->> 'checksum', op.payload ->> 'extracted_text',
            case when jsonb_typeof(op.payload -> 'metadata') = 'object' then op.payload -> 'metadata' else '{}'::jsonb end,
            auth.uid(), auth.uid()
          );
          target_version := 1;

        else
          update public.sync_operations set status = 'FAILED', error_code = 'UNSUPPORTED_ENTITY', server_timestamp = now() where id = op.id;
          return jsonb_build_object('id', op.id, 'status', 'FAILED', 'error_code', 'UNSUPPORTED_ENTITY');
      end case;

    elsif op.operation in ('UPDATE', 'DELETE') then
      case op.entity_type
        when 'task' then
          select version into current_version from public.tasks
           where id = op.entity_id and workspace_id = op.workspace_id and deleted_at is null
           for update;
          if not found or op.base_version is distinct from current_version then
            update public.sync_operations set status = 'CONFLICT', error_code = 'VERSION_CONFLICT', server_version = current_version, server_timestamp = now() where id = op.id;
            return jsonb_build_object('id', op.id, 'status', 'CONFLICT', 'error_code', 'VERSION_CONFLICT', 'server_version', current_version);
          end if;
          if op.operation = 'DELETE' then
            update public.tasks set deleted_at = now(), version = version + 1, updated_by = auth.uid(), updated_at = now()
             where id = op.entity_id and workspace_id = op.workspace_id;
          else
            update public.tasks set
              title = case when op.payload ? 'title' then op.payload ->> 'title' else title end,
              description = case when op.payload ? 'description' then op.payload ->> 'description' else description end,
              status = case when op.payload ? 'status' then (op.payload ->> 'status')::public.task_status else status end,
              priority = case when op.payload ? 'priority' then (op.payload ->> 'priority')::public.task_priority else priority end,
              due_at = case when op.payload ? 'due_at' then nullif(op.payload ->> 'due_at', '')::timestamptz else due_at end,
              assigned_to = case when op.payload ? 'assigned_to' then nullif(op.payload ->> 'assigned_to', '')::uuid else assigned_to end,
              parent_task_id = case when op.payload ? 'parent_task_id' then nullif(op.payload ->> 'parent_task_id', '')::uuid else parent_task_id end,
              metadata = case when jsonb_typeof(op.payload -> 'metadata') = 'object' then op.payload -> 'metadata' else metadata end,
              version = version + 1, updated_by = auth.uid(), updated_at = now()
             where id = op.entity_id and workspace_id = op.workspace_id;
          end if;
          target_version := current_version + 1;

        when 'project' then
          select version into current_version from public.projects
           where id = op.entity_id and workspace_id = op.workspace_id and deleted_at is null
           for update;
          if not found or op.base_version is distinct from current_version then
            update public.sync_operations set status = 'CONFLICT', error_code = 'VERSION_CONFLICT', server_version = current_version, server_timestamp = now() where id = op.id;
            return jsonb_build_object('id', op.id, 'status', 'CONFLICT', 'error_code', 'VERSION_CONFLICT', 'server_version', current_version);
          end if;
          if op.operation = 'DELETE' then
            update public.projects set deleted_at = now(), version = version + 1, updated_by = auth.uid(), updated_at = now()
             where id = op.entity_id and workspace_id = op.workspace_id;
          else
            update public.projects set
              name = case when op.payload ? 'name' then op.payload ->> 'name' else name end,
              description = case when op.payload ? 'description' then op.payload ->> 'description' else description end,
              status = case when op.payload ? 'status' then (op.payload ->> 'status')::public.project_status else status end,
              priority = case when op.payload ? 'priority' then (op.payload ->> 'priority')::public.task_priority else priority end,
              start_date = case when op.payload ? 'start_date' then nullif(op.payload ->> 'start_date', '')::date else start_date end,
              target_date = case when op.payload ? 'target_date' then nullif(op.payload ->> 'target_date', '')::date else target_date end,
              metadata = case when jsonb_typeof(op.payload -> 'metadata') = 'object' then op.payload -> 'metadata' else metadata end,
              version = version + 1, updated_by = auth.uid(), updated_at = now()
             where id = op.entity_id and workspace_id = op.workspace_id;
          end if;
          target_version := current_version + 1;

        when 'note' then
          select version into current_version from public.notes
           where id = op.entity_id and workspace_id = op.workspace_id and deleted_at is null
           for update;
          if not found or op.base_version is distinct from current_version then
            update public.sync_operations set status = 'CONFLICT', error_code = 'VERSION_CONFLICT', server_version = current_version, server_timestamp = now() where id = op.id;
            return jsonb_build_object('id', op.id, 'status', 'CONFLICT', 'error_code', 'VERSION_CONFLICT', 'server_version', current_version);
          end if;
          if op.operation = 'DELETE' then
            update public.notes set deleted_at = now(), version = version + 1, updated_by = auth.uid(), updated_at = now()
             where id = op.entity_id and workspace_id = op.workspace_id;
          else
            update public.notes set
              title = case when op.payload ? 'title' then op.payload ->> 'title' else title end,
              content = case when jsonb_typeof(op.payload -> 'content') = 'object' then op.payload -> 'content' else content end,
              plain_text = case when op.payload ? 'plain_text' then op.payload ->> 'plain_text' else plain_text end,
              note_type = case when op.payload ? 'note_type' then op.payload ->> 'note_type' else note_type end,
              version = version + 1, updated_by = auth.uid(), updated_at = now()
             where id = op.entity_id and workspace_id = op.workspace_id;
          end if;
          target_version := current_version + 1;

        when 'document' then
          select version into current_version from public.documents
           where id = op.entity_id and workspace_id = op.workspace_id and deleted_at is null
           for update;
          if not found or op.base_version is distinct from current_version then
            update public.sync_operations set status = 'CONFLICT', error_code = 'VERSION_CONFLICT', server_version = current_version, server_timestamp = now() where id = op.id;
            return jsonb_build_object('id', op.id, 'status', 'CONFLICT', 'error_code', 'VERSION_CONFLICT', 'server_version', current_version);
          end if;
          if op.operation = 'DELETE' then
            update public.documents set deleted_at = now(), version = version + 1, updated_by = auth.uid(), updated_at = now()
             where id = op.entity_id and workspace_id = op.workspace_id;
          else
            update public.documents set
              name = case when op.payload ? 'name' then op.payload ->> 'name' else name end,
              category = case when op.payload ? 'category' then op.payload ->> 'category' else category end,
              file_size = case when op.payload ? 'file_size' then nullif(op.payload ->> 'file_size', '')::bigint else file_size end,
              checksum = case when op.payload ? 'checksum' then op.payload ->> 'checksum' else checksum end,
              extracted_text = case when op.payload ? 'extracted_text' then op.payload ->> 'extracted_text' else extracted_text end,
              metadata = case when jsonb_typeof(op.payload -> 'metadata') = 'object' then op.payload -> 'metadata' else metadata end,
              version = version + 1, updated_by = auth.uid(), updated_at = now()
             where id = op.entity_id and workspace_id = op.workspace_id;
          end if;
          target_version := current_version + 1;

        else
          update public.sync_operations set status = 'FAILED', error_code = 'UNSUPPORTED_ENTITY', server_timestamp = now() where id = op.id;
          return jsonb_build_object('id', op.id, 'status', 'FAILED', 'error_code', 'UNSUPPORTED_ENTITY');
      end case;
    else
      update public.sync_operations set status = 'FAILED', error_code = 'UNSUPPORTED_OPERATION', server_timestamp = now() where id = op.id;
      return jsonb_build_object('id', op.id, 'status', 'FAILED', 'error_code', 'UNSUPPORTED_OPERATION');
    end if;

  exception
    when unique_violation then
      update public.sync_operations set status = 'CONFLICT', error_code = 'ENTITY_ALREADY_EXISTS', server_timestamp = now() where id = op.id;
      return jsonb_build_object('id', op.id, 'status', 'CONFLICT', 'error_code', 'ENTITY_ALREADY_EXISTS');
    when invalid_text_representation or not_null_violation or check_violation or numeric_value_out_of_range then
      update public.sync_operations set status = 'FAILED', error_code = 'INVALID_PAYLOAD', server_timestamp = now() where id = op.id;
      return jsonb_build_object('id', op.id, 'status', 'FAILED', 'error_code', 'INVALID_PAYLOAD');
    when others then
      update public.sync_operations set status = 'FAILED', error_code = 'PROCESSING_ERROR', server_timestamp = now() where id = op.id;
      return jsonb_build_object('id', op.id, 'status', 'FAILED', 'error_code', 'PROCESSING_ERROR');
  end;

  update public.sync_operations
     set status = 'SYNCED', error_code = null, server_version = target_version, server_timestamp = now()
   where id = op.id;

  return jsonb_build_object(
    'id', op.id,
    'status', 'SYNCED',
    'server_version', target_version,
    'server_timestamp', now()
  );
end;
$$;

revoke all on function public.process_sync_operation(uuid) from public;
revoke all on function public.process_sync_operation(uuid) from anon;
grant execute on function public.process_sync_operation(uuid) to authenticated;
