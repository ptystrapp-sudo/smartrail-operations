-- ============ ENUMS ============
create type public.app_role as enum ('commuter','station_staff','supervisor','admin');
create type public.ticket_status as enum ('active','used','expired','cancelled');
create type public.ticket_type as enum ('single','return','weekly','monthly');
create type public.payment_status as enum ('pending','completed','failed','refunded');
create type public.validation_result as enum ('valid','invalid','overridden');
create type public.route_status as enum ('operational','suspended','maintenance');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  phone_number text,
  station_assignment uuid,
  active_status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('station_staff','supervisor','admin')
  )
$$;

-- ============ STATIONS ============
create table public.stations (
  id uuid primary key default gen_random_uuid(),
  station_name text not null unique,
  region text not null,
  active_status boolean not null default true,
  daily_capacity int not null default 5000,
  created_at timestamptz not null default now()
);
alter table public.stations enable row level security;

-- ============ ROUTES ============
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  origin_station uuid not null references public.stations(id),
  destination_station uuid not null references public.stations(id),
  estimated_duration int not null, -- minutes
  fare numeric(10,2) not null,
  route_status public.route_status not null default 'operational',
  created_at timestamptz not null default now(),
  check (origin_station <> destination_station)
);
alter table public.routes enable row level security;
create index on public.routes(origin_station);
create index on public.routes(destination_station);

-- ============ TICKETS ============
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route_id uuid not null references public.routes(id),
  qr_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''),
  ticket_type public.ticket_type not null default 'single',
  ticket_status public.ticket_status not null default 'active',
  payment_status public.payment_status not null default 'pending',
  fare_paid numeric(10,2) not null,
  purchase_timestamp timestamptz not null default now(),
  activation_timestamp timestamptz,
  expiry_timestamp timestamptz not null,
  validation_count int not null default 0,
  max_validations int not null default 1,
  created_at timestamptz not null default now()
);
alter table public.tickets enable row level security;
create index on public.tickets(user_id);
create index on public.tickets(qr_token);
create index on public.tickets(ticket_status);

-- ============ VALIDATION LOGS ============
create table public.validation_logs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete set null,
  scanned_by uuid references auth.users(id) on delete set null,
  station_id uuid references public.stations(id),
  scan_timestamp timestamptz not null default now(),
  validation_result public.validation_result not null,
  failure_reason text,
  override_used boolean not null default false,
  override_reason text,
  qr_token_attempted text
);
alter table public.validation_logs enable row level security;
create index on public.validation_logs(ticket_id);
create index on public.validation_logs(scanned_by);
create index on public.validation_logs(scan_timestamp desc);

-- ============ TRANSACTIONS ============
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete set null,
  amount numeric(10,2) not null,
  payment_method text not null,
  transaction_status public.payment_status not null default 'pending',
  payment_reference text not null unique default 'TXN-' || upper(substring(md5(random()::text),1,12)),
  created_at timestamptz not null default now()
);
alter table public.transactions enable row level security;
create index on public.transactions(user_id);

-- ============ AUDIT LOGS ============
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  entity_type text not null,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
create index on public.audit_logs(created_at desc);
create index on public.audit_logs(entity_type, entity_id);

-- ============ NEW USER TRIGGER ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone_number)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.raw_user_meta_data->>'phone_number'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'commuter');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ updated_at trigger ============
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger set_updated_at_profiles before update on public.profiles
for each row execute function public.tg_set_updated_at();

-- ============ RLS POLICIES ============

-- profiles
create policy "profiles select own or staff" on public.profiles for select
  using (auth.uid() = id or public.is_staff(auth.uid()));
create policy "profiles update own" on public.profiles for update
  using (auth.uid() = id);
create policy "profiles admin update any" on public.profiles for update
  using (public.has_role(auth.uid(),'admin'));

-- user_roles (users see own; admins see all; only admins write)
create policy "roles select own or admin" on public.user_roles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "roles admin all" on public.user_roles for all
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- stations: read for any authenticated; admin writes
create policy "stations read auth" on public.stations for select
  to authenticated using (true);
create policy "stations admin write" on public.stations for all
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- routes
create policy "routes read auth" on public.routes for select
  to authenticated using (true);
create policy "routes admin write" on public.routes for all
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- tickets: owner or staff
create policy "tickets select own or staff" on public.tickets for select
  using (auth.uid() = user_id or public.is_staff(auth.uid()));
create policy "tickets insert own" on public.tickets for insert
  with check (auth.uid() = user_id);
create policy "tickets update own" on public.tickets for update
  using (auth.uid() = user_id);
create policy "tickets staff update" on public.tickets for update
  using (public.is_staff(auth.uid()));

-- validation_logs
create policy "vlogs staff read" on public.validation_logs for select
  using (public.is_staff(auth.uid()));
create policy "vlogs owner read" on public.validation_logs for select
  using (exists(select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid()));
create policy "vlogs staff insert" on public.validation_logs for insert
  with check (public.is_staff(auth.uid()) and scanned_by = auth.uid());

-- transactions
create policy "tx select own or admin" on public.transactions for select
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "tx insert own" on public.transactions for insert
  with check (auth.uid() = user_id);

-- audit_logs
create policy "audit insert authenticated" on public.audit_logs for insert
  to authenticated with check (actor_id = auth.uid());
create policy "audit read staff" on public.audit_logs for select
  using (public.is_staff(auth.uid()));

-- ============ SEED DATA ============
insert into public.stations (station_name, region, daily_capacity) values
  ('Durban Station','Central',25000),
  ('Berea Road','Central',8000),
  ('Umgeni Road','North',6000),
  ('Greyville','Central',5000),
  ('Rossburgh','South',7000),
  ('Merebank','South',9000),
  ('Isipingo','South',12000),
  ('Umlazi','South',18000),
  ('KwaMashu','North',16000),
  ('Phoenix','North',11000),
  ('Reunion','South',6500),
  ('Duffs Road','North',5500);

-- routes
do $$
declare
  s_durban uuid; s_berea uuid; s_umgeni uuid; s_grey uuid; s_ross uuid;
  s_mere uuid; s_isi uuid; s_umlazi uuid; s_kwa uuid; s_phx uuid; s_reu uuid; s_duf uuid;
begin
  select id into s_durban from public.stations where station_name='Durban Station';
  select id into s_berea from public.stations where station_name='Berea Road';
  select id into s_umgeni from public.stations where station_name='Umgeni Road';
  select id into s_grey from public.stations where station_name='Greyville';
  select id into s_ross from public.stations where station_name='Rossburgh';
  select id into s_mere from public.stations where station_name='Merebank';
  select id into s_isi from public.stations where station_name='Isipingo';
  select id into s_umlazi from public.stations where station_name='Umlazi';
  select id into s_kwa from public.stations where station_name='KwaMashu';
  select id into s_phx from public.stations where station_name='Phoenix';
  select id into s_reu from public.stations where station_name='Reunion';
  select id into s_duf from public.stations where station_name='Duffs Road';

  insert into public.routes (origin_station, destination_station, estimated_duration, fare) values
    (s_durban, s_umlazi, 45, 14.50),
    (s_durban, s_kwa, 38, 13.00),
    (s_durban, s_phx, 52, 16.00),
    (s_durban, s_isi, 35, 12.50),
    (s_durban, s_mere, 28, 10.00),
    (s_durban, s_ross, 22, 9.00),
    (s_durban, s_berea, 8, 6.50),
    (s_durban, s_umgeni, 12, 7.00),
    (s_durban, s_grey, 6, 6.00),
    (s_durban, s_reu, 40, 13.50),
    (s_durban, s_duf, 30, 11.00),
    (s_umlazi, s_isi, 18, 7.50),
    (s_kwa, s_phx, 22, 8.00),
    (s_kwa, s_duf, 14, 6.50),
    (s_isi, s_mere, 12, 5.50),
    (s_mere, s_ross, 10, 5.00),
    (s_phx, s_duf, 18, 7.00),
    (s_berea, s_umgeni, 6, 4.50);
end $$;