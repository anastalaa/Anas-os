-- Makes client retries idempotent when a response is lost after server acceptance.
-- Do not apply to production without the explicit database deployment decision.
alter table public.sync_operations
  add column if not exists client_operation_id uuid;

create unique index if not exists sync_operations_client_operation_unique
  on public.sync_operations(user_id, device_id, client_operation_id)
  where client_operation_id is not null;
