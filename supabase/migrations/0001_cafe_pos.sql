-- Schéma du POS Café (projet Supabase partagé avec le POS Boucherie :
-- toutes les tables sont préfixées cafe_).
-- Appliqué sur le projet htrtsflnxdircnitjoqc.

create table if not exists public.cafe_shop (
  id boolean primary key default true check (id),
  name text not null default 'Café Central',
  address text not null default '',
  phone text not null default '',
  currency text not null default 'DH',
  footer text not null default 'Merci de votre visite !',
  updated_at timestamptz not null default now()
);

create table if not exists public.cafe_cashiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin text not null check (pin ~ '^[0-9]{4}$'),
  admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.cafe_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  category text not null default 'Divers',
  emoji text not null default '🍽️',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cafe_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null default now(),
  opened_by text not null,
  opening_float numeric(10,2) not null default 0,
  closed_at timestamptz,
  closed_by text,
  counted_cash numeric(10,2)
);

-- Une seule caisse ouverte à la fois : un seul poste dans le café.
create unique index if not exists cafe_sessions_one_open
  on public.cafe_sessions ((closed_at is null)) where closed_at is null;

create sequence if not exists public.cafe_order_number_seq;

create table if not exists public.cafe_orders (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.cafe_order_number_seq'),
  session_id uuid not null references public.cafe_sessions(id) on delete cascade,
  cashier_id uuid references public.cafe_cashiers(id) on delete set null,
  cashier_name text not null,
  created_at timestamptz not null default now(),
  lines jsonb not null,
  total numeric(10,2) not null check (total >= 0)
);

create index if not exists cafe_orders_session_idx on public.cafe_orders (session_id);
create index if not exists cafe_orders_created_idx on public.cafe_orders (created_at desc);

-- Imprimante ticket ESC/POS (réseau, port brut 9100), pilotée par l'agent local.
alter table public.cafe_shop
  add column if not exists printer_enabled boolean not null default false,
  add column if not exists printer_agent_url text not null default 'http://127.0.0.1:7777',
  add column if not exists printer_ip text not null default '192.168.123.100',
  add column if not exists printer_port int not null default 9100,
  add column if not exists printer_cut boolean not null default true,
  add column if not exists printer_beep boolean not null default false;

alter table public.cafe_shop enable row level security;
alter table public.cafe_cashiers enable row level security;
alter table public.cafe_products enable row level security;
alter table public.cafe_sessions enable row level security;
alter table public.cafe_orders enable row level security;

-- Le POS tourne avec la clé publiable (rôle anon) : accès ouvert aux tables
-- d'exploitation, mais les codes PIN ne sont jamais lisibles côté client.
do $$
declare tbl text;
begin
  foreach tbl in array array['cafe_shop', 'cafe_products', 'cafe_sessions', 'cafe_orders'] loop
    execute format('drop policy if exists %I on public.%I', tbl || '_anon_all', tbl);
    execute format(
      'create policy %I on public.%I for all to anon using (true) with check (true)',
      tbl || '_anon_all', tbl
    );
  end loop;
end $$;

drop policy if exists cafe_cashiers_anon_write on public.cafe_cashiers;
create policy cafe_cashiers_anon_write on public.cafe_cashiers
  for insert to anon with check (true);

drop policy if exists cafe_cashiers_anon_update on public.cafe_cashiers;
create policy cafe_cashiers_anon_update on public.cafe_cashiers
  for update to anon using (true) with check (true);

drop policy if exists cafe_cashiers_anon_delete on public.cafe_cashiers;
create policy cafe_cashiers_anon_delete on public.cafe_cashiers
  for delete to anon using (true);

-- Liste des caissiers sans le PIN.
create or replace view public.cafe_cashiers_public
with (security_invoker = false) as
  select id, name, admin, created_at from public.cafe_cashiers order by created_at;

revoke all on public.cafe_cashiers_public from anon, authenticated;
grant select on public.cafe_cashiers_public to anon, authenticated;

-- Un code à 4 chiffres se devine vite : on limite les essais côté serveur.
create table if not exists public.cafe_pin_attempts (
  cashier_id uuid primary key references public.cafe_cashiers(id) on delete cascade,
  failures int not null default 0,
  locked_until timestamptz
);

alter table public.cafe_pin_attempts enable row level security;
-- Aucune policy : seule la fonction SECURITY DEFINER y touche.

create or replace function public.cafe_verify_pin(p_cashier_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked timestamptz;
  v_ok boolean;
begin
  select locked_until into v_locked from public.cafe_pin_attempts where cashier_id = p_cashier_id;
  if v_locked is not null and v_locked > now() then
    raise exception 'Trop d''essais. Réessayez dans % secondes.', ceil(extract(epoch from v_locked - now()));
  end if;

  select exists (
    select 1 from public.cafe_cashiers where id = p_cashier_id and pin = p_pin
  ) into v_ok;

  if v_ok then
    delete from public.cafe_pin_attempts where cashier_id = p_cashier_id;
  else
    insert into public.cafe_pin_attempts (cashier_id, failures)
    values (p_cashier_id, 1)
    on conflict (cashier_id) do update
      set failures = public.cafe_pin_attempts.failures + 1,
          locked_until = case
            when public.cafe_pin_attempts.failures + 1 >= 5 then now() + interval '60 seconds'
            else null
          end;
    perform pg_sleep(0.3);
  end if;

  return v_ok;
end;
$$;

revoke all on function public.cafe_verify_pin(uuid, text) from public;
grant execute on function public.cafe_verify_pin(uuid, text) to anon, authenticated;

-- Temps réel : le poste et le téléphone voient les mêmes données sans rechargement.
do $$
declare tbl text;
begin
  foreach tbl in array array['cafe_shop', 'cafe_products', 'cafe_sessions', 'cafe_orders', 'cafe_cashiers'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
