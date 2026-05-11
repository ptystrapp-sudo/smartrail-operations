
create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.app_settings enable row level security;

create policy "settings read auth" on public.app_settings
  for select to authenticated using (true);

create policy "settings admin write" on public.app_settings
  for all using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

create trigger app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.tg_set_updated_at();

insert into public.app_settings (key, value, description) values
  ('ticket_expiry_hours', '24'::jsonb, 'Hours until an unused single ticket expires'),
  ('validation_timeout_seconds', '5'::jsonb, 'Scanner debounce / validation window in seconds'),
  ('cancellation_window_minutes', '15'::jsonb, 'Minutes after purchase a commuter can cancel for refund'),
  ('refund_eligible', 'true'::jsonb, 'Whether cancellation refunds are currently allowed'),
  ('maintenance_mode', 'false'::jsonb, 'When true, ticket purchases are blocked network-wide'),
  ('operating_hours', '{"start":"04:30","end":"22:30"}'::jsonb, 'Daily network operating window')
on conflict (key) do nothing;

-- prevent duplicate route pairs
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'routes_origin_destination_key'
  ) then
    alter table public.routes
      add constraint routes_origin_destination_key unique (origin_station, destination_station);
  end if;
end $$;
